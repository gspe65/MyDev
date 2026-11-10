from fastapi import FastAPI

app = FastAPI(title="MyDev FastAPI", version="1.0.0")

@app.get("/")
def root():
    return {"message": "FastAPI Hello World", "status": "ok"}

@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI!", "status": "ok"}

@app.get("/api/hello/{name}")
def hello_name(name: str):
    return {"message": f"Hello, {name}!", "status": "ok"}
