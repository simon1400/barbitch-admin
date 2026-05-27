import { NoonaActivityLog } from '../../components/NoonaActivityLog'

export default function HistoryTab() {
  return (
    <>
      <h3 className="text-2xl font-bold text-gray-800 mb-6">Blokace kalendáře v Noona</h3>
      <NoonaActivityLog />
    </>
  )
}
