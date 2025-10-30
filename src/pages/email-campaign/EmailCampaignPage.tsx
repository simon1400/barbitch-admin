import { useState, useEffect } from 'react'
import { Container } from '../../components/Container'
import Button from '../../components/Button'

interface EmailRecipient {
  email: string
  variables?: Record<string, string>
}

type CampaignMode = 'personalized' | 'bulk'

interface TemplateConfig {
  name: string
  title: string
  subject: string
  variables: string[]
  exampleJson: string
}

const templates: Record<string, TemplateConfig> = {
  'birthday-discount': {
    name: 'Narozeninová sleva',
    title: 'Všechno nejlepší k narozeninám!',
    subject: 'Všechno nejlepší k narozeninám! 🎉',
    variables: ['name', 'discount', 'validUntil'],
    exampleJson: JSON.stringify([
      {
        email: "example1@email.com",
        variables: {
          name: "Jana",
          discount: "20",
          validUntil: "31.12.2025"
        }
      },
      {
        email: "example2@email.com",
        variables: {
          name: "Petra",
          discount: "20",
          validUntil: "31.12.2025"
        }
      }
    ], null, 2)
  },
}

const EmailCampaignPage = () => {
  const [mode, setMode] = useState<CampaignMode>('personalized')
  const [template, setTemplate] = useState('birthday-discount')
  const [subject, setSubject] = useState(templates['birthday-discount'].subject)
  const [recipientsJson, setRecipientsJson] = useState('')
  const [bulkEmails, setBulkEmails] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; details?: string } | null>(null)

  // Update subject when template changes
  useEffect(() => {
    setSubject(templates[template].subject)
  }, [template])

  // Example emails list for bulk
  const exampleBulkEmails = `example1@email.com
example2@email.com
example3@email.com`

  const currentTemplate = templates[template]

  const handleSendEmails = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      let recipients: EmailRecipient[] = []

      if (mode === 'personalized') {
        // Parse JSON for personalized emails
        try {
          recipients = JSON.parse(recipientsJson)
          if (!Array.isArray(recipients)) {
            throw new Error('JSON must be an array')
          }
        } catch (error) {
          setMessage({ type: 'error', text: 'Neplatný JSON formát' })
          setLoading(false)
          return
        }
      } else {
        // Parse email list for bulk emails
        const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e)
        if (emails.length === 0) {
          setMessage({ type: 'error', text: 'Zadejte alespoň jeden email' })
          setLoading(false)
          return
        }
        recipients = emails.map(email => ({ email }))
      }

      const response = await fetch('http://localhost:3000/api/send-bulk-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template,
          subject,
          recipients,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Úspěšně odesláno ${data.successful} z ${data.total} emailů`,
          details: data.failed > 0 ? `Selhalo: ${data.failed}` : undefined
        })
        // Clear form
        if (mode === 'personalized') {
          setRecipientsJson('')
        } else {
          setBulkEmails('')
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Nepodařilo se odeslat emaily' })
      }
    } catch (error) {
      console.error('Error sending emails:', error)
      setMessage({ type: 'error', text: 'Chyba při odesílání emailů' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="pb-20 min-h-screen bg-gray-50">
      <Container size="lg">
        <div className="py-8">
          {/* Navigation */}
          <div className="mb-6">
            <Button text="← Zpět na Global" to="/global" />
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Email kampaň</h1>
            <p className="text-gray-600">
              Odeslat marketingové emaily zákazníkům s personalizací nebo hromadně
            </p>
          </div>

          <div className="bg-white shadow-md rounded-xl p-8 max-w-4xl">
            <form onSubmit={handleSendEmails} className="space-y-6">
              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Režim odeslání
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="personalized"
                      checked={mode === 'personalized'}
                      onChange={(e) => setMode(e.target.value as CampaignMode)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-gray-700">Personalizované emaily (s proměnnými)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      value="bulk"
                      checked={mode === 'bulk'}
                      onChange={(e) => setMode(e.target.value as CampaignMode)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-gray-700">Hromadné (bez personalizace)</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6"></div>

              {/* Template Selection */}
              <div>
                <label htmlFor="template" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email šablona <span className="text-red-500">*</span>
                </label>
                <select
                  id="template"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                >
                  {Object.entries(templates).map(([key, config]) => (
                    <option key={key} value={key}>{config.name}</option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Vyberte email šablonu pro kampaň
                </p>
              </div>

              {/* Subject */}
              <div>
                <label htmlFor="subject" className="block text-sm font-semibold text-gray-700 mb-2">
                  Předmět emailu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="Všechno nejlepší k narozeninám!"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Automaticky vyplněno ze šablony, můžete upravit
                </p>
              </div>

              {/* Recipients - Personalized Mode */}
              {mode === 'personalized' && (
                <div>
                  <label htmlFor="recipientsJson" className="block text-sm font-semibold text-gray-700 mb-2">
                    Příjemci (JSON) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="recipientsJson"
                    value={recipientsJson}
                    onChange={(e) => setRecipientsJson(e.target.value)}
                    required
                    rows={12}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder={currentTemplate.exampleJson}
                  />
                  <details className="mt-2">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                      Zobrazit příklad JSON formátu
                    </summary>
                    <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-x-auto">
{currentTemplate.exampleJson}
                    </pre>
                  </details>
                  <p className="text-sm text-gray-500 mt-2">
                    Pro šablonu "{currentTemplate.name}" používejte proměnné: <strong>{currentTemplate.variables.join(', ')}</strong>
                  </p>
                </div>
              )}

              {/* Recipients - Bulk Mode */}
              {mode === 'bulk' && (
                <div>
                  <label htmlFor="bulkEmails" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email adresy (jeden na řádek) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="bulkEmails"
                    value={bulkEmails}
                    onChange={(e) => setBulkEmails(e.target.value)}
                    required
                    rows={10}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all font-mono text-sm"
                    placeholder={exampleBulkEmails}
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Zadejte email adresy, každá na nový řádek
                  </p>
                </div>
              )}

              {/* Message */}
              {message && (
                <div
                  className={`p-4 rounded-lg border ${
                    message.type === 'success'
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{message.text}</span>
                    {message.details && (
                      <span className="text-sm mt-1">{message.details}</span>
                    )}
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
                  {loading ? 'Odesílání...' : 'Odeslat kampaň'}
                </button>

                <a
                  href="/global"
                  className="px-8 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors shadow-md"
                >
                  Zrušit
                </a>
              </div>
            </form>
          </div>
        </div>
      </Container>
    </section>
  )
}

export default EmailCampaignPage
