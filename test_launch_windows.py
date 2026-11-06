import json
import os
import socket
import sys
import tempfile
import threading
import types
import unittest
import urllib.request
from pathlib import Path

import launch


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class BundledBridgeTests(unittest.TestCase):
    """开箱即用：数据桥必须真的随仓库分发，而不是要求用户再下载别的项目。"""

    def test_bridge_files_are_bundled(self):
        bridge = launch.ROOT / 'bridge'
        self.assertTrue((bridge / 'douyin-bridge.mjs').exists())
        self.assertTrue((bridge / 'bridge-ws.mjs').exists())
        # MIT 合规：必须保留上游版权声明
        self.assertTrue((bridge / 'LICENSE').exists())
        license_text = (bridge / 'LICENSE').read_text(encoding='utf-8')
        self.assertIn('MIT License', license_text)
        self.assertIn('志哥AI', license_text)

    def test_bridge_dir_prefers_bundled(self):
        saved = os.environ.pop('ARENA_BRIDGE_DIR', None)
        try:
            self.assertEqual(launch.bridge_dir(), launch.ROOT / 'bridge')
        finally:
            if saved is not None:
                os.environ['ARENA_BRIDGE_DIR'] = saved

    def test_env_override_wins(self):
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / 'douyin-bridge.mjs').write_text('// fake', encoding='utf-8')
            os.environ['ARENA_BRIDGE_DIR'] = tmp
            try:
                self.assertEqual(launch.bridge_dir(), Path(tmp))
            finally:
                os.environ.pop('ARENA_BRIDGE_DIR', None)


class WindowSizeTests(unittest.TestCase):
    def test_landscape_fits_work_area(self):
        width, height = launch.window_size(1920, 1080, 'landscape')
        self.assertLessEqual(width, 1920)
        self.assertLessEqual(height, 1080)
        self.assertGreater(width, 560)
        self.assertGreater(width, height)                 # 横屏必须更宽

    def test_portrait_never_taller_than_screen(self):
        width, height = launch.window_size(1920, 1080, 'portrait')
        self.assertLessEqual(height, 1080)
        self.assertGreater(height, width)                 # 竖屏必须更高

    def test_tiny_screen_still_gives_usable_window(self):
        width, height = launch.window_size(1024, 600, 'portrait-1080p')
        self.assertGreaterEqual(width, 300)
        self.assertGreaterEqual(height, 420)
        self.assertLessEqual(width, 1024)
        self.assertLessEqual(height, 600)
        self.assertGreater(height, width)                 # 小屏也保持竖屏比例

    def test_headless_work_area_keeps_orientation(self):
        """回归：CI runner 没有真实桌面时会退化成 1280x800，
        旧实现把竖屏算成 760x760 正方形（CI 就是这样挂的）。"""
        for area in ((1280, 800), (1024, 768), (800, 600), (640, 480)):
            landscape = launch.window_size(*area, 'landscape')
            portrait = launch.window_size(*area, 'portrait')
            self.assertGreater(landscape[0], landscape[1], f'横屏退化了: {area} {landscape}')
            self.assertGreater(portrait[1], portrait[0], f'竖屏退化了: {area} {portrait}')
            self.assertLessEqual(landscape[0], area[0])
            self.assertLessEqual(portrait[1], area[1])


class MimeTests(unittest.TestCase):
    def test_module_scripts_are_pinned(self):
        # Windows 注册表常把 .mjs 映射成 text/plain，浏览器会拒绝加载模块
        self.assertEqual(launch.MIME_TYPES['.mjs'], 'text/javascript')
        self.assertEqual(launch.MIME_TYPES['.js'], 'text/javascript')
        self.assertIn('charset=utf-8', launch.MIME_TYPES['.html'])


class ServerTests(unittest.TestCase):
    def setUp(self):
        self._orig = (launch.bridge_status, launch.bridge_log_tail)
        # 让 /__bridge-status 立刻返回，不依赖本机有没有数据桥（CI 上更稳更快）
        launch.bridge_status = lambda: {'ok': False}
        launch.bridge_log_tail = lambda lines=8, max_chars=1200: ''

    def tearDown(self):
        launch.bridge_status, launch.bridge_log_tail = self._orig

    def test_server_answers_health_and_bridge_status(self):
        port = free_port()
        url, server = launch.ensure_server(port)
        try:
            self.assertIsNotNone(server)
            with urllib.request.urlopen(url + '__health', timeout=10) as response:
                self.assertEqual(json.load(response)['app'], 'avatar-arena')
            with urllib.request.urlopen(url + '__bridge-status', timeout=10) as response:
                payload = json.load(response)
            self.assertIn('ok', payload)
            self.assertIsInstance(payload['ok'], bool)
        finally:
            server.shutdown()
            server.server_close()

    def test_serves_index_as_html(self):
        port = free_port()
        url, server = launch.ensure_server(port)
        try:
            with urllib.request.urlopen(url + 'index.html', timeout=3) as response:
                self.assertIn('text/html', response.headers.get('Content-Type', ''))
                body = response.read(2000).decode('utf-8', 'replace')
            self.assertIn('<!DOCTYPE html>', body)
        finally:
            server.shutdown()
            server.server_close()


class FakeWebview(types.ModuleType):
    def __init__(self):
        super().__init__('webview')
        self.calls = []
        self.starts = []

    def create_window(self, title, url=None, **kwargs):
        self.calls.append((title, url, kwargs))
        return types.SimpleNamespace(title=title, url=url)

    def start(self, func=None, **kwargs):
        self.starts.append(kwargs)


class LaunchTests(unittest.TestCase):
    def setUp(self):
        self._orig_work_area = launch.work_area
        # 固定工作区尺寸，测试不依赖跑测试的机器有没有真实桌面（CI 上尤其重要）
        launch.work_area = lambda: (1920, 1080)

    def tearDown(self):
        launch.work_area = self._orig_work_area

    def run_main(self, argv):
        fake = FakeWebview()
        argv_backup = sys.argv
        sys.modules['webview'] = fake
        sys.argv = ['launch.py'] + argv
        try:
            launch.main()
        finally:
            sys.argv = argv_backup
            sys.modules.pop('webview', None)
        return fake

    def test_default_opens_landscape_page(self):
        fake = self.run_main([])
        self.assertEqual(len(fake.calls), 1)
        title, url, kwargs = fake.calls[0]
        self.assertIn('大乱斗', title)
        self.assertTrue(url.endswith('index.html'))
        self.assertGreater(kwargs['width'], kwargs['height'])
        self.assertEqual(len(fake.starts), 1)

    def test_portrait_flag_asks_for_portrait_page(self):
        fake = self.run_main(['--portrait'])
        _, url, kwargs = fake.calls[0]
        self.assertIn('portrait=1', url)
        self.assertLess(kwargs['width'], kwargs['height'])


class LiveConnectionTests(unittest.TestCase):
    """抖音接入链路：房间号解析、直播间窗口、数据桥启动的前置条件。"""

    def setUp(self):
        self._orig = (launch.bridge_status, launch.listening, launch.bridge_dir,
                      launch.cdp_pages, launch.wait_for_room_tab,
                      launch.bridge_log_tail, launch.subprocess.Popen, launch.BRIDGE_PROC)

    def tearDown(self):
        (launch.bridge_status, launch.listening, launch.bridge_dir,
         launch.cdp_pages, launch.wait_for_room_tab,
         launch.bridge_log_tail, launch.subprocess.Popen, launch.BRIDGE_PROC) = self._orig

    def test_room_id_accepts_digits_and_full_link(self):
        self.assertEqual(launch.room_id('123456789'), '123456789')
        self.assertEqual(launch.room_id('https://live.douyin.com/123456789?x=1'), '123456789')
        self.assertEqual(launch.room_id('hello'), '')
        self.assertEqual(launch.room_id(''), '')

    def test_open_live_rejects_invalid_room_without_spawning(self):
        result = launch.open_live_room('not-a-room')
        self.assertFalse(result['ok'])
        self.assertIn('直播间号', result['error'])

    def test_start_bridge_asks_to_open_live_window_first(self):
        launch.bridge_status = lambda: {'ok': False}
        launch.listening = lambda port, timeout=0.3: False
        launch.bridge_dir = lambda: launch.ROOT
        result = launch.start_bridge('123456')
        self.assertFalse(result['ok'])
        self.assertIn('打开直播间窗口', result['error'])

    def test_start_bridge_explains_missing_printer_project(self):
        launch.bridge_status = lambda: {'ok': False}
        launch.listening = lambda port, timeout=0.3: True     # 直播间窗口已开
        launch.bridge_dir = lambda: None
        result = launch.start_bridge('123456')
        self.assertFalse(result['ok'])
        self.assertIn('ARENA_BRIDGE_DIR', result['error'])

    def test_start_bridge_short_circuits_when_already_running(self):
        launch.bridge_status = lambda: {'ok': True, 'url': 'ws://127.0.0.1:8765', 'port': 8765}
        launch.bridge_log_tail = lambda lines=2, max_chars=1200: '💬 小鱼干：666'
        result = launch.start_bridge('123456')
        self.assertTrue(result['ok'])
        self.assertTrue(result.get('already'))

    def test_stop_bridge_is_safe_when_idle(self):
        launch.BRIDGE_PROC = None
        self.assertTrue(launch.stop_bridge()['ok'])

    def test_diag_reports_bridge_window_and_log(self):
        launch.bridge_status = lambda: {'ok': True, 'url': 'ws://127.0.0.1:8765', 'room': '123456'}
        launch.listening = lambda port, timeout=0.3: True
        launch.bridge_dir = lambda: None
        diag = launch.build_diag()
        self.assertTrue(diag['bridge']['ok'])
        self.assertIn('liveWindow', diag)
        self.assertIn('logTail', diag)
        self.assertFalse(diag['bridgeFound'])

    def test_wait_for_room_tab_accepts_matching_url(self):
        launch.cdp_pages = lambda port=9223, timeout=1.5: [
            {'url': 'https://live.douyin.com/123456', 'title': '直播间'}]
        self.assertTrue(launch.wait_for_room_tab('123456', timeout=0.2))
        self.assertFalse(launch.wait_for_room_tab('999999', timeout=0.2))

    def test_start_bridge_explains_wrong_live_tab(self):
        launch.bridge_status = lambda: {'ok': False}
        launch.listening = lambda port, timeout=0.3: True
        launch.bridge_dir = lambda: launch.ROOT
        launch.wait_for_room_tab = lambda room, timeout=12.0: None
        launch.cdp_pages = lambda port=9223, timeout=1.5: [
            {'url': 'https://www.douyin.com/', 'title': '抖音'}]
        result = launch.start_bridge('123456')
        self.assertFalse(result['ok'])
        self.assertIn('live.douyin.com/123456', result['error'])
        self.assertIn('www.douyin.com', result['error'])

    def test_bridge_stuck_reason_detects_retry_loop(self):
        launch.bridge_log_tail = lambda lines=2, max_chars=1200: '❌ 独立直播窗口未就绪，请完成登录后重新开始抓取，3 秒后重试'
        self.assertIn('未就绪', launch.bridge_stuck_reason())
        launch.bridge_log_tail = lambda lines=2, max_chars=1200: '💬 小鱼干：666'
        self.assertEqual(launch.bridge_stuck_reason(), '')

    def test_start_bridge_reports_stuck_existing_bridge(self):
        launch.bridge_status = lambda: {'ok': True, 'url': 'ws://127.0.0.1:8765'}
        launch.bridge_log_tail = lambda lines=2, max_chars=1200: '❌ 独立直播窗口未就绪，请完成登录后重新开始抓取，3 秒后重试'
        result = launch.start_bridge('123456')
        self.assertFalse(result['ok'])
        self.assertIn('空跑', result['error'])

    def test_start_bridge_does_not_force_cdp_env(self):
        """回归测试：曾把 PRINTER_CDP_PORT 传给采集器，导致它只守一个端口、不再找标签页。"""
        import tempfile
        from pathlib import Path as _Path
        with tempfile.TemporaryDirectory() as tmp:
            base = _Path(tmp)
            (base / 'douyin-bridge.mjs').write_text('// fake', encoding='utf-8')
            launch.listening = lambda port, timeout=0.3: True
            launch.bridge_dir = lambda: base
            launch.wait_for_room_tab = lambda room, timeout=12.0: {'url': 'https://live.douyin.com/123456'}
            calls = {'n': 0}

            def fake_status():
                calls['n'] += 1
                return {'ok': False} if calls['n'] == 1 else {'ok': True, 'url': 'ws://127.0.0.1:8765'}

            launch.bridge_status = fake_status
            captured = {}

            class FakeProc:
                def poll(self):
                    return None

            def fake_popen(cmd, **kwargs):
                captured['cmd'] = [str(c) for c in cmd]
                captured['env'] = kwargs.get('env') or {}
                captured['cwd'] = str(kwargs.get('cwd'))
                return FakeProc()

            launch.subprocess.Popen = fake_popen
            result = launch.start_bridge('123456')
            self.assertTrue(result['ok'], result)
            self.assertNotIn('PRINTER_CDP_PORT', captured['env'])
            self.assertTrue(any('douyin-bridge.mjs' in part for part in captured['cmd']))
            self.assertIn('123456', captured['cmd'])


if __name__ == '__main__':
    unittest.main()
