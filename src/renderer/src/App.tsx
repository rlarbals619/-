import { useEffect, useState } from 'react'
import { getAppVersion, isElectron, storage } from './platform'

const COUNTER_KEY = 'demo:counter'

function App(): JSX.Element {
  const [version, setVersion] = useState('…')
  const [count, setCount] = useState(() => Number(storage.get(COUNTER_KEY) ?? 0))

  const electron = isElectron()

  useEffect(() => {
    getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    storage.set(COUNTER_KEY, String(count))
  }, [count])

  return (
    <main className="app">
      <h1>Electron + React + TS</h1>
      <p className="subtitle">Local-first, web-portable skeleton</p>

      <span className={`badge ${electron ? 'badge--electron' : 'badge--web'}`}>
        {electron ? '🖥️ Running in Electron' : '🌐 Running in Browser'}
      </span>

      <dl className="info">
        <dt>App version</dt>
        <dd>{version}</dd>
      </dl>

      <div className="counter">
        <button onClick={() => setCount((c) => c - 1)}>−</button>
        <span className="counter__value">{count}</span>
        <button onClick={() => setCount((c) => c + 1)}>+</button>
      </div>
      <p className="hint">Counter persists via the platform storage adapter.</p>
    </main>
  )
}

export default App
