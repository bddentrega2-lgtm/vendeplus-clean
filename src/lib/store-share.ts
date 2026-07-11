export function buildStoreWelcomeMessage({
  storeName,
  catalogUrl,
}: {
  storeName: string;
  catalogUrl: string;
}) {
  return [
    `🎉 ¡Felicidades! Ya estás listo para vender más con ${storeName}.`,
    "",
    "Copia y pega este como tu nuevo mensaje de bienvenida:",
    "",
    `👋 Hola, bienvenido a ${storeName}.`,
    "Ahora puedes hacer tus pedidos más sencillo a través de nuestro link para clientes.",
    "",
    "🛒 Accede aquí:",
    catalogUrl,
  ].join("\n");
}
