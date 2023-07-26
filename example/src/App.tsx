import React, { useState } from 'react'

import './App.css'
import logo from './logo.svg'
import VolumetricPlayer from './VolumetricPlayer'

function App() {
  const [playerVisible, setPlayerVisible] = useState(false)
  const paths = ['/liam.uvol.json']
  return (
    <div className="App">
      <button className={'button player-toggle'} onClick={() => setPlayerVisible(!playerVisible)}>
        {playerVisible ? 'off' : 'on'}
      </button>
      {!playerVisible ? null : (
        <VolumetricPlayer
          paths={paths}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh'
          }}
        />
      )}
    </div>
  )
}

export default App
