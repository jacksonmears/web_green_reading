import { useState } from "react";
import "./App.css";
import GreenReader from "./components/GreenReader.jsx";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <GreenReader />
    </>
  );
}

export default App;
