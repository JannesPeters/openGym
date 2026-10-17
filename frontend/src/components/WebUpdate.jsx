import { useSyncExternalStore } from 'react'
import { getWebUpdate, subscribeWebUpdate } from '../lib/web-update.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'

export default function WebUpdate() {
  const update = useSyncExternalStore(subscribeWebUpdate, getWebUpdate)
  if (!update.available) return null
  return <div className="card row" role="status" style={{ flexWrap: 'wrap', gap: 12 }}>
    <p style={{ flex: '1 1 180px', margin: 0 }}>{t('An update is ready. Finish editing, then reload openGym.')}</p>
    <Button size="sm" onClick={() => window.location.reload()}>{t('Reload openGym')}</Button>
  </div>
}
