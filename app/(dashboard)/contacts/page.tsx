import { redirect } from 'next/navigation'

// Halaman umum /contacts sudah dipecah ke /contacts/customers dan /contacts/vendors
export default function ContactsPage() {
  redirect('/contacts/customers')
}
