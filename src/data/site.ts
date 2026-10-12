// Datos de contacto del laboratorio: única fuente para enlaces, formulario y pie.
export const contact = {
	whatsapp: '3215378110',
	phone: '+57 (321) 537 8110-TECH',
	phoneHref: 'tel:+573215378110',
	email: 'jcpenagos716@outlook.com',
	address: 'Calle 7  # 20A - 110, Yumbo, Valle del Cauca, Colombia',
	hours: 'Lunes a Sábado: 09:00 - 19:00 hrs',
};

export const whatsappUrl = (text: string) =>
	`https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(text)}`;
