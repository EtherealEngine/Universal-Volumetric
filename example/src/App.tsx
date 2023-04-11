import React, { useState } from 'react'
import logo from './logo.svg'
import './App.css'
import VolumetricPlayer from "./VolumetricPlayer";

console.log('import.meta.url', import.meta.url)

function App() {
  const [playerVisible, setPlayerVisible] = useState(false)
  const paths = [
    "/yoga.uvol"
  ]
  return (
    <div className="App">
      <button
        className={"button player-toggle"}
        onClick={() => setPlayerVisible(!playerVisible)}>{playerVisible? "off" : "on"}</button>
      {!playerVisible ? null : <VolumetricPlayer
        paths = {paths}
        style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh'}}
      />}
    </div>
  )
}

export default App
