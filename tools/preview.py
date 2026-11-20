#!/usr/bin/env python3
"""Serve the package with firmware LuCI assets and isolated demo RPC state."""
import argparse
import gettext
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import mimetypes
from pathlib import Path
import re
import subprocess
import time
from urllib.parse import urlsplit

REPO = Path(__file__).resolve().parent.parent
ASSETS = REPO / 'htdocs'
CONFIG = 'h5000m_pwmfan'
BASE = '/cgi-bin/luci/admin/system/h5000m_pwmfan'


def settings():
    config = (REPO / 'root/etc/config/h5000m_pwmfan').read_text()
    result = dict(re.findall(r"^\s*option (\w+) '([^']*)'", config, re.M))
    return {CONFIG: {'main': {'.name': 'main', '.type': 'settings', **result}},
            'luci': {'main': {'.name': 'main', '.type': 'core', 'lang': 'zh_cn'}}}


def demo_status(mode):
    now = int(time.time())
    samples = [('cpu', 'cpu-thermal', 52400), ('rf', 'mt7996_phy0.0_temp1', 38200),
               ('modem', 'modem', 46200), ('phy', 'mdio_bus:01_temp1', 42300)]
    values = [(key, label, temp + (now // 2 % 12) * 65) for key, label, temp in samples]
    requested = {'quiet': 60, 'performance': 192, 'off': 0, 'target': 51}.get(mode, 128)
    rows = ';'.join(f'{key}|{label}|{temp}|ok' for key, label, temp in values)
    return (f'state=running\nowner=userspace\nreason={mode}\nupdated_at={now}\n'
            f'temperature_mc={values[0][2]}\nrequested_pwm={requested}\neffective_pwm={requested}\n'
            f'protection_pwm=0\nlanguage_zh_available=1\nsensors={rows}\n'
            f'protection_count_24h=1\nprotection_count_total=2\nprotection_last_trigger={now - 900}\nprotection_last_cycle_peak_c=91\n')


def make_handler(rootfs, messages):
    config = settings()

    class Preview(BaseHTTPRequestHandler):
        def send_data(self, data, content_type):
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            path = urlsplit(self.path).path
            if path == '/':
                self.send_response(302)
                self.send_header('Location', BASE + '/dashboard')
                self.end_headers()
                return
            if path == '/demo-translations.js':
                lang = config['luci']['main']['lang']
                zh = lang == 'zh_cn' or (lang == 'auto' and self.headers.get('Accept-Language', '').lower().startswith('zh'))
                catalog = json.dumps(messages if zh else {}, ensure_ascii=False)
                js = f'window.TR = Object.fromEntries(Object.entries({catalog}).map(([key, value]) => [sfh(trimws(key)), value]));'
                self.send_data(js.encode(), 'application/javascript; charset=utf-8')
                return
            if path in (BASE + '/dashboard', BASE + '/advanced'):
                self.send_data((REPO / 'tools/preview.html').read_bytes(), 'text/html; charset=utf-8')
                return
            if path.startswith('/luci-static/'):
                for root in (ASSETS, rootfs / 'www'):
                    target = (root / path.lstrip('/')).resolve()
                    if target.is_relative_to(root.resolve()) and target.is_file():
                        content_type = mimetypes.guess_type(target)[0] or 'application/octet-stream'
                        self.send_data(target.read_bytes(), content_type)
                        return
            self.send_error(404)

        def call(self, rpc):
            if rpc.get('method') == 'list':
                return {}
            _, name, method, args = rpc['params']
            if name == 'file' and method == 'list':
                return [0, {'entries': []}]
            if name == 'file' and method == 'exec':
                if args.get('command') == '/usr/sbin/h5000m-pwmfan-status':
                    if args.get('params') == ['temperatures']:
                        now = int(time.time())
                        rows = ''.join(f'{now + i}|{52400 + (i % 67) * 45}|{38200 + (i % 33) * 37}|{46200 + (i % 33) * 50}|{42300 + (i % 64) * 27}\n' for i in range(-900, 0, 2))
                        return [0, {'code': 0, 'stdout': rows}]
                    return [0, {'code': 0, 'stdout': demo_status(config[CONFIG]['main']['mode'])}]
                if args.get('command') == '/usr/sbin/h5000m-pwmfan-language':
                    language, = args['params']
                    if language in ('en', 'zh_cn', 'auto'):
                        config['luci']['main']['lang'] = language
                        return [0, {'code': 0}]
                return [0, {'code': 1}]
            if name == 'uci':
                package = config.get(args.get('config'), {})
                if method == 'get':
                    return [0, {'values': package.get(args['section'], {}) if args.get('section') else package}]
                if method == 'set':
                    package[args['section']].update(args['values'])
                    return [0]
                if method == 'delete':
                    for key in args.get('options', []):
                        package[args['section']].pop(key, None)
                    return [0]
                if method in ('apply', 'confirm', 'changes'):
                    return [0]
            if name == 'session' and method == 'access':
                return [0, {'access': True}]
            if name == 'luci' and method == 'getFeatures':
                return [0, {}]
            return [3]

        def do_POST(self):
            if not self.path.startswith('/ubus'):
                self.send_error(404)
                return
            length = int(self.headers['Content-Length'])
            if length > 65536:
                self.send_error(413)
                return
            try:
                messages = json.loads(self.rfile.read(length))
                def reply(message):
                    return {'jsonrpc': '2.0', 'id': message['id'], 'result': self.call(message)}
                result = [reply(message) for message in messages] if isinstance(messages, list) else reply(messages)
            except (KeyError, ValueError, TypeError):
                self.send_error(400)
                return
            self.send_data(json.dumps(result).encode(), 'application/json')

    return Preview


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rootfs', type=Path)
    parser.add_argument('--port', type=int, default=8026)
    args = parser.parse_args()
    if not (args.rootfs / 'www/luci-static/vantage/vantage.css').is_file():
        parser.error('rootfs must contain the Vantage theme assets')
    mo = subprocess.check_output(['msgfmt', '-o', '-', str(REPO / 'po/zh_Hans/h5000m-pwmfan.po')])
    from io import BytesIO
    messages = {key: value for key, value in gettext.GNUTranslations(BytesIO(mo))._catalog.items() if key}
    HTTPServer(('127.0.0.1', args.port), make_handler(args.rootfs.resolve(), messages)).serve_forever()


if __name__ == '__main__':
    main()
