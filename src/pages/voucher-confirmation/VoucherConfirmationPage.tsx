import { useState, useEffect } from 'react'
import { hintCls, kickerCls, pageShellCls } from '../../ui/kit'
import { Axios } from '../../lib/api'
const clientUrl = import.meta.env.VITE_CLIENT_URL;

interface FormData {
  email: string
  buyerName: string
  recipientName: string
  voucherId: string
  validUntil: string
}

interface Voucher {
  id: number
  name: string
  for: string
  sum: number
  email: string
  phone: string
  dateOrder: string
  datePay: string | null
  dateRealized: string | null
  commentAdmin: string
  comentUser: string
  idVoucher: string
}

const VoucherConfirmationPage = () => {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [selectedVoucherId, setSelectedVoucherId] = useState<string>('')
  const [formData, setFormData] = useState<FormData>({
    email: '',
    buyerName: '',
    recipientName: '',
    voucherId: '',
    validUntil: '',
  })

  const [loading, setLoading] = useState(false)
  const [loadingVouchers, setLoadingVouchers] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Fetch vouchers from Strapi
  useEffect(() => {
    const fetchVouchers = async () => {
      try {
        const response = await Axios.get<Voucher[]>('/api/vouchers?filters[dateRealized][$null]=true&filters[datePay][$notNull]=true&sort=dateOrder:desc')
        // Axios interceptor returns response.data.data, so response is already the array
        setVouchers((response || []) as unknown as Voucher[])
      } catch (error) {
        console.error('Error fetching vouchers:', error)
        setMessage({ type: 'error', text: 'Nepodařilo se načíst vouchery' })
      } finally {
        setLoadingVouchers(false)
      }
    }

    fetchVouchers()
  }, [])

  // Handle voucher selection
  const handleVoucherSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voucherId = e.target.value
    setSelectedVoucherId(voucherId)

    if (!voucherId) {
      setFormData({
        email: '',
        buyerName: '',
        recipientName: '',
        voucherId: '',
        validUntil: '',
      })
      return
    }

    const voucher = vouchers.find(v => v.id.toString() === voucherId)
    if (voucher) {
      // Calculate valid until date (6 months from order date)
      const orderDate = new Date(voucher.dateOrder)
      const validUntil = new Date(orderDate)
      validUntil.setMonth(validUntil.getMonth() + 6)
      const formattedDate = validUntil.toLocaleDateString('cs-CZ')

      setFormData({
        email: voucher.email || '',
        buyerName: voucher.name || '',
        recipientName: voucher.for || '',
        voucherId: voucher.idVoucher || '',
        validUntil: formattedDate,
      })
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`${clientUrl}/api/send-confirmation-voucher`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: 'Email byl úspěšně odeslán!' })
        // Reset form
        setFormData({
          email: '',
          buyerName: '',
          recipientName: '',
          voucherId: '',
          validUntil: '',
        })
      } else {
        setMessage({ type: 'error', text: data.error || 'Nepodařilo se odeslat email' })
      }
    } catch (error) {
      console.error('Error sending email:', error)
      setMessage({ type: 'error', text: 'Chyba při odesílání emailu' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={pageShellCls}>
        <div>
          <div className={kickerCls}>Barbitch Admin</div>
          <h1 className="m-0 mb-1.5 text-[24px] leading-[1.2] font-extrabold text-[#161615]">
            Potvrzení voucheru
          </h1>
          <p className={`m-0 mb-[18px] ${hintCls}`}>
            Odeslat email klientovi s potvrzením, že voucher byl zaplacen a je aktivní
          </p>

          <div className="bg-white border border-[#eee9e6] rounded-xl shadow-[0_1px_2px_rgba(22,22,21,0.04)] px-6 py-[22px] max-w-3xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Voucher Select */}
              <div>
                <label htmlFor="voucherSelect" className="block text-sm font-semibold text-[#4c4844] mb-2">
                  Vybrat voucher ze Strapi
                </label>
                {loadingVouchers ? (
                  <div className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#8b857f]">
                    Načítání voucherů...
                  </div>
                ) : (
                  <select
                    id="voucherSelect"
                    value={selectedVoucherId}
                    onChange={handleVoucherSelect}
                    className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  >
                    <option value="">-- Vyberte voucher nebo vyplňte ručně --</option>
                    {vouchers.map((voucher) => (
                      <option key={voucher.id} value={voucher.id}>
                        #{voucher.idVoucher} - {voucher.name} → {voucher.for} ({voucher.sum} Kč) - {new Date(voucher.dateOrder).toLocaleDateString('cs-CZ')}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm font-normal text-[#8b857f] mt-1">
                  Zobrazeny pouze vouchery bez dateRealized
                </p>
              </div>

              <div className="border-t border-[#eee9e6] pt-6"></div>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-[#4c4844] mb-2">
                  Email příjemce <span className="text-[#c53030]">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="example@email.com"
                />
              </div>

              {/* Buyer Name */}
              <div>
                <label htmlFor="buyerName" className="block text-sm font-semibold text-[#4c4844] mb-2">
                  Jméno objednatele <span className="text-[#c53030]">*</span>
                </label>
                <input
                  type="text"
                  id="buyerName"
                  name="buyerName"
                  value={formData.buyerName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="Petra Nováková"
                />
              </div>

              {/* Recipient Name */}
              <div>
                <label htmlFor="recipientName" className="block text-sm font-semibold text-[#4c4844] mb-2">
                  Jméno příjemce voucheru <span className="text-[#c53030]">*</span>
                </label>
                <input
                  type="text"
                  id="recipientName"
                  name="recipientName"
                  value={formData.recipientName}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="Jana Dvořáková"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Voucher ID */}
                <div>
                  <label htmlFor="voucherId" className="block text-sm font-semibold text-[#4c4844] mb-2">
                    ID voucheru <span className="text-[#c53030]">*</span>
                  </label>
                  <input
                    type="text"
                    id="voucherId"
                    name="voucherId"
                    value={formData.voucherId}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                    placeholder="12345"
                  />
                </div>

                {/* Valid Until */}
                <div>
                  <label htmlFor="validUntil" className="block text-sm font-semibold text-[#4c4844] mb-2">
                    Platný do <span className="text-[#c53030]">*</span>
                  </label>
                  <input
                    type="text"
                    id="validUntil"
                    name="validUntil"
                    value={formData.validUntil}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-[#e7e2de] rounded-lg text-[#161615] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                    placeholder="31.12.2025"
                  />
                </div>
              </div>

              <p className="text-sm text-[#8b857f]">Formát data: DD.MM.YYYY</p>

              {/* Message */}
              {message && (
                <div
                  className={`p-4 rounded-lg border ${
                    message.type === 'success'
                      ? 'bg-[#e8f6ee] border-[#bfe4cd] text-green-800'
                      : 'bg-[#fdecec] border-[#f3c1c1] text-red-800'
                  }`}
                >
                  <div className="flex items-center">
                    <span className="font-medium">{message.text}</span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#e71e6e] text-white font-semibold rounded-lg hover:bg-[#c91a5e] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? 'Odesílání...' : 'Odeslat email'}
                </button>

                <a
                  href="/"
                  className="px-8 py-3 bg-gray-200 text-[#4c4844] font-semibold rounded-lg hover:bg-gray-300 transition-colors shadow-md"
                >
                  Zpět
                </a>
              </div>
            </form>
          </div>
        </div>
    </div>
  )
}

export default VoucherConfirmationPage
