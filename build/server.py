#!/usr/bin/env python3
import http.server
import socketserver
import sys
from pathlib import Path

DEFAULT_PORT = 8000

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

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT

    httpd = socketserver.TCPServer(("", port), SPAHandler)

    print(f"Serving at http://localhost:{port}")
    sys.stdout.flush()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()
        httpd.server_close()
