// «Rozpis směn» (s278): отдельный модуль администраторки — недельный график «кто дежурит»
// заполняют сами администраторки (раньше — только панель Strapi или владелец во вкладке
// «Команда → Смены администраторов»). Экран тот же (`ShiftsTab`), по-чешски: прошлые недели
// только для чтения, удаления недели нет — гейт на сервере (`week_locked`, requireManagement).
import { h1Cls, kickerCls, pageShellCls } from '../../ui/kit'
import ShiftsTab from '../global/team/tabs/ShiftsTab'

export default function RozpisPage() {
  return (
    <div className={pageShellCls} data-testid="rozpis-page">
      <div className="mb-4">
        <div className={kickerCls}>Barbitch Admin</div>
        <h1 className={h1Cls}>Rozpis směn</h1>
      </div>
      <ShiftsTab lang="cs" administrator />
    </div>
  )
}
