import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacidad | Somos",
  description: "Como Somos utiliza y protege los datos de compradores.",
};

export default function PrivacyPage() {
  return <main className="buyer-account-page buyer-privacy-page">
    <Link href="/marketplace" className="buyer-back"><ArrowLeft size={18} />Marketplace</Link>
    <header><div><ShieldCheck size={28} /><h1>Privacidad</h1></div></header>
    <p className="buyer-privacy-updated">Ultima actualizacion: 1 de octubre de 2026</p>

    <section>
      <h2>Datos que utilizamos</h2>
      <p>Para procesar una compra podemos solicitar nombre, telefono, cedula cuando el comercio la requiera, direccion, referencia, ubicacion elegida, detalles del pedido, forma de pago y comprobante de pago cuando corresponda.</p>
      <p>Si ingresas con Google, Somos recibe los datos basicos autorizados por Google, como correo e identificador de cuenta. No recibimos tu contrasena de Google.</p>
    </section>

    <section>
      <h2>Para que se usan</h2>
      <p>Usamos estos datos para crear y entregar pedidos, mostrar tu historial, permitir calificaciones, prevenir duplicados y fraude, enviar avisos operativos y atender incidencias.</p>
      <p>Tu nombre, telefono, cedula y ubicacion frecuente pueden guardarse localmente en tu dispositivo cuando eliges recordarlos. Puedes modificarlos o borrarlos desde Mis datos.</p>
    </section>

    <section>
      <h2>Con quien se comparten</h2>
      <p>Los datos necesarios del pedido se comparten con el comercio seleccionado y, cuando aplica, con la empresa o persona encargada de la entrega. Los proveedores tecnicos de autenticacion, alojamiento, base de datos y notificaciones procesan datos solo para operar Somos.</p>
      <p>No vendemos los datos personales de compradores.</p>
    </section>

    <section>
      <h2>Ubicacion y notificaciones</h2>
      <p>La ubicacion se solicita solo cuando decides usarla para elegir ciudad, calcular o indicar una entrega. Puedes negar el permiso y escribir la direccion manualmente. Las notificaciones se usan para avisos relacionados con pedidos y operacion de la app.</p>
    </section>

    <section>
      <h2>Conservacion y eliminacion</h2>
      <p>Puedes eliminar tu cuenta o solicitar su eliminacion desde esta pagina. Si la cuenta administra comercios o empresas delivery, revisamos primero sus accesos para no dejar la operacion sin responsable. Los pedidos, catalogos y registros de facturacion pueden conservarse cuando exista una necesidad comercial, de seguridad o legal.</p>
      <Link href="/eliminar-cuenta" className="buyer-account-link">Eliminar mi cuenta</Link>
    </section>

    <section>
      <h2>Seguridad y control</h2>
      <p>Aplicamos controles de acceso y separacion entre comercios. Ningun sistema es infalible, por lo que limitamos el acceso a la informacion necesaria para cada operacion.</p>
      <p>Esta pagina describe el tratamiento actual de datos de compradores en Somos. Antes de una publicacion general se completaran los datos legales y de contacto del responsable en la ficha oficial de la aplicacion.</p>
    </section>
  </main>;
}
