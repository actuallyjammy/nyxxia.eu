export default function Home() {
  return (
    <main className="home">
      <p className="eyebrow">jammy.cat · Barcelona</p>
      <section aria-labelledby="intro-ca">
        <h1 id="intro-ca">Hola, soc en Jammy!</h1>
        <p>Visc a Barcelona. Aquest és el meu espai personal, on comparteixo els meus projectes i les coses que m’interessen.</p>
      </section>
      <section lang="en" aria-labelledby="intro-en" className="english">
        <h2 id="intro-en">Hi, I’m Jammy!</h2>
        <p>I live in Barcelona. This is my personal website, where I share my projects and interests.</p>
      </section>
    </main>
  );
}
