from flask import Flask, send_from_directory


app = Flask(__name__, static_folder=".", static_url_path="")


@app.get("/")
def root():
    return send_from_directory(".", "index.html")


@app.get("/<path:path>")
def static_files(path):
    return send_from_directory(".", path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
