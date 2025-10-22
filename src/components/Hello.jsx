// src/components/Hello.jsx

export default function Hello({ name }) {
  return (
    <div style={{ padding: "1rem", border: "1px solid #ccc", marginTop: "1rem" }}>
      <h2>Hello, {name} 👋</h2>
      <p>This component lives in <code>src/components/Hello.jsx</code></p>
    </div>
  );
}
