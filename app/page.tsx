export default function Home() {
  return (
    <main className="home">
      <p className="eyebrow">jammy.cat · Barcelona</p>
      <section aria-labelledby="intro-ca">
        <h1 id="intro-ca">Hola, soc en Jammy!</h1>
        <p>Visc a Barcelona. Aquest és el meu espai personal, on comparteixo els meus projectes i les coses que m’interessen.</p>
        <h2>Projectes</h2>
        <p><a href="/parliament.html">Simulador de parlaments i eleccions →</a></p>
        <p>Explora escenaris electorals, reparteix escons i prova diferents coalicions. Inclou eines per simular les eleccions dels Estats Units i de Catalunya.</p>
      </section>
      <section lang="en" aria-labelledby="intro-en" className="english">
        <h2 id="intro-en">Hi, I’m Jammy!</h2>
        <p>I live in Barcelona. This is my personal website, where I share my projects and interests.</p>
        <h3>Projects</h3>
        <p><a href="/parliament.html">Parliament and election simulator →</a></p>
        <p>Explore election scenarios, allocate seats, and try different coalitions, with tools for US and Catalan elections.</p>
      </section>
    </main>
  );
}
