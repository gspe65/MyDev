from flask import Flask

app = Flask(__name__)

@app.route("/")
def index():
    return "<h1>Flask Hello World</h1><p>MyDev funziona!</p>"

@app.route("/api/hello")
def api_hello():
    return {"message": "Hello from Flask!", "status": "ok"}

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
