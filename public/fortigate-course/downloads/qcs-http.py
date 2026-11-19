# Fixed-response teaching service. No file serving; lab address only.
from http.server import BaseHTTPRequestHandler, HTTPServer
class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/":
            self.send_error(404); return
        data=b"QCS local lab: fixed response\n"
        self.send_response(200)
        self.send_header("Content-Type","text/plain; charset=utf-8")
        self.send_header("Content-Length",str(len(data)))
        self.send_header("Connection","close")
        self.end_headers(); self.wfile.write(data)
    def log_message(self, fmt, *args):
        print(self.log_date_time_string(), self.client_address[0], fmt % args, flush=True)
HTTPServer(("10.77.20.10",8080),Handler).serve_forever()
