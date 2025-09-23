const donationUrl = (import.meta as any).env?.VITE_STRIPE_DONATION_URL as string | undefined

export default function DonationButton() {
  if (!donationUrl) return null

  return (
    <a
      href={donationUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed top-3 left-3 z-50 inline-flex items-center gap-2 px-3 py-2 rounded-md bg-pink-600 text-white shadow hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-400"
      aria-label="Haz una donación"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M12 21s-6.716-4.623-9.193-7.1C.985 11.078 1.07 7.77 3.05 5.79a5.012 5.012 0 0 1 7.071 0L12 7.667l1.879-1.878a5.012 5.012 0 0 1 7.071 7.071C18.716 16.377 12 21 12 21z" />
      </svg>
      <span>Donate</span>
    </a>
  )
}
