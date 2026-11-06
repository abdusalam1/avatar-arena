"""头像大乱斗 · 独立桌面壳（自己的 HTTP 服务 + 自己的 WebView2 窗口与配置目录）。

架构和「头像打印机」保持一致：
  · launch.py 起一个只监听 127.0.0.1 的静态服务（钉死 MIME，避免 Windows 把 .mjs 当 text/plain）
  · 页面通过 /__bridge-status 找到本机的直播数据桥（只读探测，不改动打印项目）
  · pywebview 开一个独立窗口，配置目录独立，不干扰打印项目的登录态
"""
import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent

# 不和打印项目的 8080/8081 抢端口
DEFAULT_PORTS = (8090, 8091, 8190, 8290, 8380)
BRIDGE_PORTS = range(8765, 8775)

# ES module 在 Windows 上常被注册表映射成 text/plain，浏览器会拒绝加载：
# 这里显式钉死类型，不信任本机注册表。
MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
}

ORIENTATIONS = {
    'landscape': (1280, 820),
    'landscape-1080p': (1920, 1080),
    'portrait': (760, 1280),
    'portrait-1080p': (1080, 1920),
}

_LOCAL_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
_BRIDGE_CACHE = None


def listening(port, timeout=0.3):
    with socket.socket() as sock:
        sock.settimeout(timeout)
        return sock.connect_ex(('127.0.0.1', port)) == 0


def local_get(url, timeout_s=1.5):
    # 本机健康检查必须直连：系统代理（Clash 等）会拦掉 127.0.0.1 请求。
    return _LOCAL_OPENER.open(url, timeout=timeout_s)


def bridge_status():
    """找本机的直播数据桥（由头像打印项目启动）。找不到就返回 ok=False，页面自动进演示模式。

    先做本地端口探测（毫秒级），只对真在监听的端口发 HTTP；结果缓存 2 秒，
    避免页面反复轮询时把探测堆起来。
    """
    global _BRIDGE_CACHE
    now = time.monotonic()
    if _BRIDGE_CACHE and now - _BRIDGE_CACHE[0] < 5:
        return dict(_BRIDGE_CACHE[1])
    result = dict(ok=False)
    for port in BRIDGE_PORTS:
        # 探测要短：没监听的端口在这台机器上会拖到 0.3s 才超时
        if not listening(port, 0.12):
            continue
        try:
            with local_get(f'http://127.0.0.1:{port}/health', 0.8) as response:
                data = json.load(response)
            if data.get('service') == 'avatar-printer':
                result = dict(ok=True, port=port, url=f'ws://127.0.0.1:{port}', room=data.get('room', ''))
                break
        except Exception:
            continue
    _BRIDGE_CACHE = (now, dict(result))
    return result


ACTIVE_PORT = 0
BRIDGE_PROC = None
BRIDGE_ROOM = ''
LIVE_CDP_PORT = 9223

BROWSER_CANDIDATES = (
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
)


def bridge_dir():
    """直播数据桥（抖音弹幕采集器）所在的目录。

    默认复用「头像打印机」项目里的 douyin-bridge.mjs —— 只调用，不修改它。
    打印项目换了位置，就用环境变量 ARENA_BRIDGE_DIR 指过去。
    """
    env_dir = os.environ.get('ARENA_BRIDGE_DIR', '').strip()
    candidates = []
    if env_dir:
        candidates.append(Path(env_dir))
    candidates += [ROOT.parent / 'LiveApp', ROOT / 'bridge']
    for candidate in candidates:
        try:
            if (candidate / 'douyin-bridge.mjs').exists():
                return candidate
        except OSError:
            continue
    return None


def find_browser():
    for candidate in BROWSER_CANDIDATES:
        if os.path.exists(candidate):
            return candidate
    return None


def room_id(raw):
    match = re.fullmatch(r'(?:https?://live\.douyin\.com/)?(\d{5,25})(?:[/?#].*)?', str(raw).strip())
    return match[1] if match else ''


def open_live_room(raw, portrait=False):
    """开一个独立浏览器窗口进直播间（带远程调试端口，采集器从里面读弹幕）。"""
    room = room_id(raw)
    if not room:
        return dict(ok=False, error='请输入有效的直播间号或链接')
    if listening(LIVE_CDP_PORT):
        return dict(ok=True, already=True, room=room)
    exe = find_browser()
    if not exe:
        return dict(ok=False, error='没找到 Edge / Chrome')
    base = bridge_dir() or ROOT
    size = '720,1280' if portrait else '1280,720'
    args = [
        exe,
        '--app=https://live.douyin.com/' + room,
        '--window-size=' + size,
        '--remote-debugging-port=' + str(LIVE_CDP_PORT),
        '--remote-debugging-address=127.0.0.1',
        '--user-data-dir=' + str(base / '.bridge-profile'),
        '--lang=zh-CN', '--no-first-run', '--no-default-browser-check',
        '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
        '--disable-background-timer-throttling',
        '--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion',
    ]
    try:
        subprocess.Popen(args)
    except OSError as exc:
        return dict(ok=False, error=str(exc))
    # 等远程调试端口真的起来：Edge/Chrome 已有实例占用同一配置目录时，
    # 新命令只会被转发给旧实例，调试端口根本不会打开 —— 必须当场报出来。
    for _ in range(24):
        if listening(LIVE_CDP_PORT):
            return dict(ok=True, room=room)
        time.sleep(0.25)
    return dict(ok=False,
                error='直播间窗口没有开起来（远程调试端口 ' + str(LIVE_CDP_PORT) + ' 未监听）。'
                      '多半是已有一个用同一配置目录的 Edge/Chrome 在跑：'
                      '请把之前的直播间窗口都关掉，再点一次「打开直播间窗口」')


def start_bridge(raw):
    """启动直播数据桥（复用打印项目的采集器），等它真正起来再返回。"""
    global BRIDGE_PROC, BRIDGE_ROOM, _BRIDGE_CACHE
    room = room_id(raw)
    if not room:
        return dict(ok=False, error='请输入有效的直播间号')
def cdp_pages(port=LIVE_CDP_PORT, timeout=1.5):
    """列出直播间窗口里的标签页（CDP /json/list）。"""
    try:
        with local_get(f'http://127.0.0.1:{port}/json/list', timeout) as response:
            pages = json.load(response)
        return [dict(url=p.get('url', ''), title=p.get('title', '')) for p in pages if p.get('type') == 'page']
    except Exception:
        return []


def wait_for_room_tab(room, timeout=12.0):
    """等直播间标签页真正打开到 live.douyin.com/<room>（登录跳转、重定向都要等）。"""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for page in cdp_pages():
            if re.search(r'live\.douyin\.com/' + re.escape(room), page.get('url', '')):
                return page
        time.sleep(0.6)
    return None


def bridge_log_tail(lines=8, max_chars=1200):
    """采集器日志最后几行——排障时最有用的东西。"""
    base = bridge_dir()
    if not base:
        return ''
    log_path = base / 'desktop-bridge.log'
    try:
        if not log_path.exists():
            return ''
        with open(log_path, 'rb') as handle:
            handle.seek(0, os.SEEK_END)
            size = handle.tell()
            handle.seek(max(0, size - 8192))
            text = handle.read().decode('utf-8', 'replace')
        tail = [line for line in text.splitlines() if line.strip()][-lines:]
        return '\n'.join(tail)[-max_chars:]
    except OSError:
        return ''


def bridge_stuck_reason():
    """8765 上有个桥在跑、却一直报"未就绪/采不到"——通常是从前遗留的僵死采集器。

    只看最后一行：健康的桥最后一行会是「💬 昵称：内容」「❤️ …」「已挂接浏览器…」这类。
    """
    tail = bridge_log_tail(2).strip()
    if not tail:
        return ''
    last = tail.splitlines()[-1]
    for marker in ('未就绪', '没找到房间标签页', '连接断开', '失败'):
        if marker in last:
            return last
    return ''


def build_diag():
    """给页面用的一键诊断：桥/窗口/采集器日志。"""
    status = bridge_status()
    pages = cdp_pages() if listening(LIVE_CDP_PORT) else []
    live_tabs = [p['url'] for p in pages if re.search(r'live\.douyin\.com/\d{5,25}', p['url'] or '')]
    return {
        'bridge': status,
        'bridgeFound': bool(bridge_dir()),
        'bridgeDir': str(bridge_dir() or ''),
        'bridgeRunning': bool(BRIDGE_PROC and BRIDGE_PROC.poll() is None),
        'bridgeRoom': BRIDGE_ROOM,
        'liveWindow': {
            'listening': listening(LIVE_CDP_PORT),
            'pages': [p['url'] for p in pages][:6],
            'liveTabs': live_tabs[:3],
            'liveTab': bool(live_tabs),
        },
        'logTail': bridge_log_tail(),
    }


def start_bridge(raw):
    """启动直播数据桥（复用打印项目的采集器），等它真正起来再返回。"""
    global BRIDGE_PROC, BRIDGE_ROOM, _BRIDGE_CACHE
    room = room_id(raw)
    if not room:
        return dict(ok=False, error='请输入有效的直播间号')
    status = bridge_status()
    if status.get('ok'):
        stuck = bridge_stuck_reason()
        if stuck:
            return dict(ok=False,
                        error='8765 端口上已经有一个采集器在空跑（最后一行日志：' + stuck + '）。'
                              '请先关掉它：在打印项目里点「停止抓取」，或结束那个 node 进程，再点「开始抓取」。')
        return dict(status, already=True)
    base = bridge_dir()
    if not base:
        return dict(ok=False, error='找不到打印项目的数据桥；请把 ARENA_BRIDGE_DIR 指向 LiveApp 目录')
    node = shutil.which('node')
    if not node:
        return dict(ok=False, error='没有安装 Node.js')
    if not listening(LIVE_CDP_PORT):
        return dict(ok=False, error='请先点「打开直播间窗口」并完成登录，再开始抓取')
    # 等标签页真正落到 live.douyin.com/<room>；没等到也继续试（采集器会自己找/开标签页）
    tab = wait_for_room_tab(room)
    if not tab:
        current = '、'.join((p.get('url') or '')[:60] for p in cdp_pages()[:3]) or '（读不到标签页）'
        return dict(ok=False,
                    error='直播间窗口还没停在 live.douyin.com/' + room + '（当前：' + current + '）'
                          + '——请在里面完成登录/进入直播间后重试')

    (base / '.bridge-room').write_text(room, encoding='utf-8')
    log = open(base / 'desktop-bridge.log', 'ab')
    try:
        # 注意：这里故意不设 PRINTER_CDP_PORT —— 打印项目自己也不设。
        # 设了它，采集器就只认那一个端口、且不会再自动找/开直播间标签页。
        BRIDGE_PROC = subprocess.Popen(
            [node, str(base / 'douyin-bridge.mjs'), room],
            cwd=str(base), env=os.environ.copy(), stdout=log, stderr=log,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except OSError as exc:
        return dict(ok=False, error=str(exc))
    finally:
        log.close()
    BRIDGE_ROOM = room
    for _ in range(50):
        if BRIDGE_PROC.poll() is not None:
            BRIDGE_PROC = None
            return dict(ok=False, error='采集器退出了：\n' + bridge_log_tail())
        _BRIDGE_CACHE = None
        status = bridge_status()
        if status.get('ok'):
            return dict(status, **{'logTail': bridge_log_tail(4)})
        time.sleep(0.2)
    return dict(ok=False, error='数据桥启动超时：\n' + bridge_log_tail())


def stop_bridge():
    """只停本程序启动的数据桥；打印项目自己启动的不去动它。"""
    global BRIDGE_PROC, BRIDGE_ROOM, _BRIDGE_CACHE
    proc = BRIDGE_PROC
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
    BRIDGE_PROC = None
    BRIDGE_ROOM = ''
    _BRIDGE_CACHE = None
    return dict(ok=True)


def work_area():
    """Windows 桌面可用区域（排除任务栏）。"""
    try:
        import ctypes
        from ctypes import wintypes
        rect = wintypes.RECT()
        if ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0):
            return max(640, rect.right - rect.left), max(480, rect.bottom - rect.top)
    except Exception:
        pass
    return 1280, 800


def window_size(area_w, area_h, orient='landscape', margin=40):
    """窗口尺寸：按屏幕可用区域收敛，永远不超出屏幕（竖屏尤其容易超过 1080p 高度）。"""
    want_w, want_h = ORIENTATIONS.get(orient, ORIENTATIONS['landscape'])
    width = min(want_w, max(560, area_w - margin))
    height = min(want_h, max(420, area_h - margin))
    return width, height


class ArenaHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, **MIME_TYPES}

    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=directory or str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def _guard(self):
        # 只允许本机页面调用会拉进程的端点：校验 Host 与同源请求头
        if not str(self.headers.get('Host', '')).startswith('127.0.0.1:' + str(ACTIVE_PORT)):
            return False
        return self.headers.get('Sec-Fetch-Site', '') in ('same-origin', 'same-site', '')

    def do_GET(self):
        if self.path == '/__bridge-status':
            payload = bridge_status()
            base = bridge_dir()
            payload['bridgeDir'] = str(base) if base else ''
            payload['bridgeFound'] = bool(base)
            return self._json(200, json.dumps(payload, ensure_ascii=False))
        if self.path == '/__health':
            return self._json(200, json.dumps({'ok': True, 'app': 'avatar-arena'}, ensure_ascii=False))
        if self.path.startswith('/__diag'):
            return self._json(200, json.dumps(build_diag(), ensure_ascii=False))
        if self.path.startswith('/__open-live'):
            if not self._guard():
                return self._json(403, '{"ok":false,"error":"forbidden"}')
            query = parse_qs(urlparse(self.path).query)
            portrait = (query.get('portrait') or ['0'])[0] == '1'
            payload = open_live_room((query.get('room') or [''])[0], portrait)
            return self._json(200 if payload.get('ok') else 400, json.dumps(payload, ensure_ascii=False))
        if self.path.startswith('/__start-bridge'):
            if not self._guard():
                return self._json(403, '{"ok":false,"error":"forbidden"}')
            query = parse_qs(urlparse(self.path).query)
            payload = start_bridge((query.get('room') or [''])[0])
            return self._json(200 if payload.get('ok') else 500, json.dumps(payload, ensure_ascii=False))
        if self.path.startswith('/__stop-bridge'):
            if not self._guard():
                return self._json(403, '{"ok":false,"error":"forbidden"}')
            return self._json(200, json.dumps(stop_bridge(), ensure_ascii=False))
        # 丢掉旧版本缓存带来的条件请求，保证 Ctrl+R 一定拿新文件
        for header in ('If-Modified-Since', 'If-None-Match'):
            if header in self.headers:
                del self.headers[header]
        return super().do_GET()

    def _json(self, code, body):
        data = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


def ensure_server(port=None):
    global ACTIVE_PORT
    candidates = [port] if port else list(DEFAULT_PORTS)
    for candidate in candidates:
        if not candidate:
            continue
        if listening(candidate):
            # 已有本项目的服务在跑就直接复用，避免开第二个
            try:
                with local_get(f'http://127.0.0.1:{candidate}/__health', 1.2) as response:
                    if json.load(response).get('app') == 'avatar-arena':
                        ACTIVE_PORT = candidate
                        return f'http://127.0.0.1:{candidate}/', None
            except Exception:
                pass
            continue
        handler = partial(ArenaHandler, directory=str(ROOT))
        server = ThreadingHTTPServer(('127.0.0.1', candidate), handler)
        ACTIVE_PORT = candidate
        threading.Thread(target=server.serve_forever, daemon=True).start()
        return f'http://127.0.0.1:{candidate}/', server
    raise RuntimeError('没有可用端口，请关闭占用 8090-8380 的程序')


def main():
    parser = argparse.ArgumentParser(description='Avatar Arena (头像大乱斗) desktop shell')
    parser.add_argument('--portrait', action='store_true', help='open a 9:16 portrait window for OBS capture')
    parser.add_argument('--orient', default='',
                        choices=['', 'landscape', 'landscape-1080p', 'portrait', 'portrait-1080p'])
    parser.add_argument('--port', type=int, default=0)
    parser.add_argument('--server-only', action='store_true')
    args = parser.parse_args()

    orient = args.orient or ('portrait' if args.portrait else 'landscape')
    url, server = ensure_server(args.port or None)
    page = url + 'index.html' + ('?portrait=1' if orient.startswith('portrait') else '')
    try:
        if args.server_only:
            threading.Event().wait()
        else:
            import webview
            area_w, area_h = work_area()
            width, height = window_size(area_w, area_h, orient)
            webview.create_window('头像大乱斗 · Avatar Battle Royale', page,
                width=width, height=height, min_size=(560, 420), background_color='#080a0e')
            webview.start(gui='edgechromium', private_mode=False,
                storage_path=str(ROOT / '.arena-webview-profile'))
    except KeyboardInterrupt:
        pass
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
