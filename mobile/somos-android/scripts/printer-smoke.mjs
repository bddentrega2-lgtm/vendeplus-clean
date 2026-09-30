const [, , action = "list", addressArg] = process.argv;
const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const tab = tabs.find((entry) => entry.type === "page");

if (!tab?.webSocketDebuggerUrl) {
  throw new Error("No hay un WebView Android disponible en el puerto 9222.");
}

const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.onopen = resolve;
  socket.onerror = reject;
});

const expression =
  action === "print"
    ? `(async () => JSON.stringify(await window.Capacitor.Plugins.SomosPrinter.printTest({ address: ${JSON.stringify(addressArg)} })))()`
    : "(async () => JSON.stringify({ status: await window.Capacitor.Plugins.SomosPrinter.getStatus(), devices: await window.Capacitor.Plugins.SomosPrinter.getPairedPrinters() }))()";

socket.send(
  JSON.stringify({
    id: 1,
    method: "Runtime.evaluate",
    params: { expression, returnByValue: true, awaitPromise: true },
  }),
);

const response = await new Promise((resolve) => {
  socket.onmessage = (event) => resolve(JSON.parse(event.data));
});
socket.close();

const result = response?.result?.result;
if (result?.subtype === "error" || result?.className === "Error") {
  throw new Error(result.description || "El plugin devolvio un error.");
}

console.log(result?.value ?? JSON.stringify(response));
