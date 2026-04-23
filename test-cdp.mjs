// Headless CDP harness to reproduce the Vite 504 on lazy-route navigation.
//
// Requires a headless Chrome running with --remote-debugging-port=9223, e.g.:
//   chrome --headless=new --user-data-dir=/tmp/chrome-cdp --remote-debugging-port=9223
//
// Usage:
//   TARGET=http://localhost:5173 CLICK_HREF=//counter node test-cdp.mjs
//
// The script opens /, clicks the nav link to /counter, and reports 504s seen.

const CDP_URL = "http://localhost:9223/json";
const TARGET = process.env.TARGET || "http://localhost:5173";
const CLICK_HREF = process.env.CLICK_HREF || "/counter";

async function cdpCall(ws, method, params = {}, id = Math.random() * 1e9 | 0) {
    return new Promise((resolve) => {
        const handler = (e) => {
            const msg = JSON.parse(e.data);
            if (msg.id === id) {
                ws.removeEventListener("message", handler);
                resolve(msg.result);
            }
        };
        ws.addEventListener("message", handler);
        ws.send(JSON.stringify({ id, method, params }));
    });
}

async function main() {
    const tabs = await (await fetch(CDP_URL)).json();
    for (const t of tabs) {
        if (t.type === "page") await fetch(`${CDP_URL}/close/${t.id}`);
    }
    const page = await (await fetch(`${CDP_URL}/new?about:blank`, { method: "PUT" })).json();

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));

    const network504s = [];
    const consoleErrors = [];
    ws.addEventListener("message", (e) => {
        const msg = JSON.parse(e.data);
        if (msg.method === "Network.responseReceived") {
            const { response } = msg.params;
            if (response.status === 504) {
                network504s.push(`${response.status} ${response.url}`);
            }
        }
        if (msg.method === "Runtime.exceptionThrown") {
            consoleErrors.push((msg.params.exceptionDetails.text || "") + " :: " + (msg.params.exceptionDetails.exception?.description || ""));
        }
    });

    await cdpCall(ws, "Network.enable");
    await cdpCall(ws, "Runtime.enable");
    await cdpCall(ws, "Page.enable");

    console.log("Navigating to /");
    await cdpCall(ws, "Page.navigate", { url: `${TARGET}/` });
    await new Promise((r) => setTimeout(r, 4000));

    console.log(`Clicking link ${CLICK_HREF}`);
    await cdpCall(ws, "Runtime.evaluate", {
        expression: `document.querySelector('a[href="${CLICK_HREF}"]').click()`,
    });
    await new Promise((r) => setTimeout(r, 4000));

    console.log("");
    console.log(`504s observed: ${network504s.length}`);
    network504s.forEach((x) => console.log("  " + x));
    console.log(`Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach((x) => console.log("  " + x));

    ws.close();
    process.exit(network504s.length > 0 ? 0 : 1);
}

main();
