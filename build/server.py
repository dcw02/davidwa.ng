#!/usr/bin/env python3
import http.server
import socketserver
from pathlib import Path

PORT = 8000

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Serve actual files if they exist
        path = Path(self.translate_path(self.path))
        if path.is_file():
            return http.server.SimpleHTTPRequestHandler.do_GET(self)

        # For directories or non-existent paths, check if it's a route
        if not self.path.startswith('/_content/') and not path.suffix:
            # Serve index.html for SPA routes
            self.path = '/index.html'

        return http.server.SimpleHTTPRequestHandler.do_GET(self)

with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
    print(f"Serving at http://localhost:{PORT}")
    httpd.serve_forever()
