/**
 * CONFIGURACIÓN DEL COTIZADOR
 * ---------------------------------------------------------------
 * Todo lo que cambia de una cotización a otra vive aquí o en
 * catalog.js. No hace falta tocar app.js ni engine.js.
 */
window.COTIZADOR_CONFIG = {
  /* Quién cotiza (aparece en el encabezado y en el PDF). Si dejas
     email/whatsapp vacíos, simplemente no se muestran. */
  developer: {
    name: 'Diego Chan',
    role: 'Desarrollo de apps y experiencia de usuario',
    email: '',
    whatsapp: '',
  },

  projectName: 'App de seguimiento nutricional y entrenamiento',

  /* URL de la aplicación web de Apps Script (termina en /exec).
     Mientras esté vacía, el cotizador funciona en modo prueba:
     genera el PDF pero no envía nada a Sheets. */
  endpoint: 'https://script.google.com/macros/s/AKfycbwNFD-lBYEsBhTbLeKn-5FJuOcnvtpGjT4MrkNBlgyn6uhCutDmfz7rn55KHglxP00q/exec',

  /* Días de vigencia de la cotización. */
  validityDays: 15,

  /* Soporte mensual = base de la plataforma + un monto por cada
     módulo según su nivel de mantenimiento. Se redondea al múltiplo
     de `roundTo` más cercano. */
  support: {
    base: 200,
    levels: { baja: 20, media: 40, alta: 70 },
    roundTo: 50,
    levelNotes: {
      baja: 'Cambia poco y casi no necesita revisión.',
      media: 'Maneja datos que crecen y se revisa con regularidad.',
      alta: 'Usa servicios externos o datos sensibles y exige vigilancia constante.',
    },
  },

  /* Tamaños para un módulo propuesto por la clienta. Son estimados:
     se confirman al revisar la idea. */
  customTiers: [
    {
      id: 'sencillo',
      name: 'Sencillo',
      price: 3000,
      days: 5,
      level: 'baja',
      hint: 'Una pantalla o función puntual, como un formulario o una lista.',
    },
    {
      id: 'mediano',
      name: 'Mediano',
      price: 6000,
      days: 10,
      level: 'media',
      hint: 'Una función con varias pantallas y datos propios.',
    },
    {
      id: 'complejo',
      name: 'Complejo',
      price: 10000,
      days: 18,
      level: 'alta',
      hint: 'Una función con reglas, cálculos o conexión con otros servicios.',
    },
  ],

  /* Pacientes activos aproximados (ayuda a dimensionar los costos
     de servicios de terceros). */
  patientRanges: ['Menos de 20', '20 a 50', '51 a 150', 'Más de 150'],

  /* Condiciones que se muestran en el resumen y en el PDF. */
  payment: '50% al iniciar cada fase y 50% al entregarla.',
  terms: [
    'Cada fase se prueba y se aprueba contigo antes de iniciar la siguiente.',
    'Cada fase incluye dos rondas de ajustes sobre lo acordado; los cambios de alcance se cotizan aparte.',
    'Los datos de tus pacientes, tus planes y el material que cargues son tuyos. Como la app guarda datos de salud, tú eres responsable del aviso de privacidad hacia tus pacientes; el desarrollador entrega la separación técnica de accesos por rol.',
    'El código base es del desarrollador y se licencia para el uso de tu consultorio.',
    'Los montos están en pesos mexicanos (MXN). Si necesitas factura, se agrega el IVA correspondiente.',
    'Esta cotización es una estimación: cada módulo se confirma contigo antes de iniciar su fase.',
  ],

  /* Costos de servicios de terceros. Se contratan a nombre de la
     nutrióloga y se pagan directo a cada proveedor.
     `needs`: solo se muestra si ese módulo está en la cotización. */
  thirdParty: [
    {
      name: 'Firebase (plan por uso)',
      use: 'Cuentas de usuario, base de datos y la función que consulta a la IA sin exponer la llave.',
      cost: 'Incluye una cuota gratuita diaria (50,000 lecturas y 20,000 escrituras en la base de datos) y cobra solo el excedente. Requiere una tarjeta registrada; con pocos pacientes se espera que quede dentro de la cuota.',
    },
    {
      name: 'Vercel Pro',
      use: 'Publicación de la app.',
      cost: '20 USD al mes. El plan gratuito de Vercel no permite uso comercial.',
    },
    {
      name: 'Dominio propio (opcional)',
      use: 'Una dirección web con el nombre de tu consultorio.',
      cost: 'Aprox. $200 a $400 MXN al año.',
    },
    {
      name: 'Servicio de IA (pago por consulta)',
      use: 'Las notas dentro de las tarjetas y los mensajes motivadores.',
      cost: 'Variable. Se mide durante su fase y se informa antes de entregarla.',
      needs: 'ia',
    },
  ],

  /* Siguiente etapa: apps en tiendas. */
  stores: {
    title: 'Después de la webapp: tu app en las tiendas',
    text: 'La app empieza como webapp: se abre desde el navegador del celular o de la computadora, sin descargar nada. Es la forma más rápida de construirla, probarla contigo y corregirla. Cuando esté estable, se empaqueta como app para App Store, Google Play u otra tienda.',
    note: 'Esa etapa se cotiza al terminar la webapp, con base en lo ya construido. Cada tienda cobra su propia cuota de desarrollador (Apple, 99 USD al año; Google Play, 25 USD por única vez) y revisa la app antes de publicarla.',
  },

  /* Textos del aviso de privacidad del formulario. */
  privacy:
    'Usaremos tus datos solo para preparar esta cotización y ponernos en contacto contigo.',
};
