(function (H5P) {
  'use strict';

  /* Page 6 — "Como o Maglev flutua e anda": video, support text, the three
   * levitation systems, the linear motor and pros and cons of Maglev. Reading page: being here
   * unlocks page 7 without watching the video. On purpose, no text says the
   * video is optional (request of the teaching team). */

  const ns = H5P.MagnetismoTransporte;
  const { plainMarkup } = ns.Util;
  const L = ns.I18n.L;

  const PT_BODY = `
      <section class="mt-card" aria-labelledby="mt-systems">
        <h2 id="mt-systems">Três jeitos de fazer um trem flutuar</h2>
        <p class="mt-muted">Todo Maglev precisa levitar (ficar suspenso), ser guiado (não escapar para os lados da via) e ser empurrado para a frente. Para flutuar parado, a força magnética para cima precisa cancelar o peso. Cada sistema resolve de um jeito o problema de os ímãs sozinhos não ficarem estáveis.</p>
        <div class="mt-systems">
          <article class="mt-system">
            <span class="mt-system__tag">Repulsão</span>
            <h3>Japão · SCMaglev (EDS)</h3>
            <p>Ímãs supercondutores no trem, resfriados com hélio líquido, induzem correntes nas bobinas do trilho (Lei de Faraday). Essas correntes criam polos iguais aos do trem, que é empurrado para cima e flutua cerca de 10 cm.</p>
            <p class="mt-system__note">Só levita em movimento: usa rodas até uns 100 a 150 km/h. Nos testes, passou de 600 km/h.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Atração</span>
            <h3>Xangai · Transrapid (EMS)</h3>
            <p>Braços em forma de C abraçam o trilho por baixo. Eletroímãs são atraídos para cima, e sensores ajustam a corrente milhares de vezes por segundo para o trem não grudar nem cair.</p>
            <p class="mt-system__note">Levita desde a partida, sem rodas, com folga de 1 a 1,5 cm controlada por computador.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Supercondutor</span>
            <h3>Brasil · MagLev-Cobra</h3>
            <p>Blocos supercondutores, resfriados com nitrogênio líquido, flutuam sobre um trilho de ímãs de neodímio. O supercondutor "prende" o campo e fica estável sozinho.</p>
            <p class="mt-system__note">Desenvolvido no LASUP da COPPE/UFRJ.</p>
          </article>
        </div>
      </section>
      <section class="mt-card mt-card--tint" aria-labelledby="mt-linear">
        <h2 id="mt-linear">E como o trem anda? O motor linear</h2>
        <p>Imagine o motor de um ventilador "desenrolado" ao longo de todo o trilho. As bobinas do trilho trocam de polo sem parar: a bobina à frente do trem atrai, e a de trás repele. Essa onda magnética percorre a via, e o trem, sem atrito com o trilho, vai junto.</p>
        <p><strong>Pense numa fila:</strong> a pessoa da frente puxa sua mão e a de trás empurra suas costas, repetidas vezes e bem rápido.</p>
      </section>
      <section class="mt-card" aria-labelledby="mt-world">
        <h2 id="mt-world">Onde os Maglev estão e o que pesa na balança</h2>
        <p class="mt-muted">Hoje, trens Maglev levam passageiros só na China e no Japão. Em Xangai fica a única linha de alta velocidade em operação, do aeroporto de Pudong até o metrô. O Japão constrói a Chuo Shinkansen, que vai ligar Tóquio a Nagoia (286 km) em cerca de 40 minutos. Reino Unido e Coreia do Sul já tiveram linhas comerciais, mas elas foram fechadas.</p>
        <div class="mt-systems mt-systems--two">
          <article class="mt-system">
            <span class="mt-system__tag">Vantagens</span>
            <h3>Rápido, econômico e silencioso</h3>
            <p>Sem encostar no trilho, o trem só enfrenta a resistência do ar: fica mais rápido e gasta menos energia em alta velocidade.</p>
            <p>Sem contato, as peças quase não se desgastam, a manutenção é menor e o barulho é bem menor que o de trens comuns e aviões.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Desafios</span>
            <h3>Caro e com via própria</h3>
            <p>A via custa muito mais que uma ferrovia comum, por causa do controle magnético de alta precisão.</p>
            <p>Não dá para usar os trilhos que já existem: a linha inteira precisa ser construída do zero.</p>
            <p class="mt-system__note">Pode substituir o avião em viagens médias e desafogar rodovias e aeroportos.</p>
          </article>
        </div>
      </section>`;

  const EN_BODY = `
      <section class="mt-card" aria-labelledby="mt-systems">
        <h2 id="mt-systems">Three ways to make a train float</h2>
        <p class="mt-muted">Every Maglev needs to levitate (stay suspended), be guided (not drift to the sides of the guideway) and be pushed forward. To float still, the upward magnetic force must cancel the weight. Each system solves in its own way the problem that magnets alone are not stable.</p>
        <div class="mt-systems">
          <article class="mt-system">
            <span class="mt-system__tag">Repulsion</span>
            <h3>Japan · SCMaglev (EDS)</h3>
            <p>Superconducting magnets on the train, cooled with liquid helium, induce currents in the coils of the guideway (Faraday's Law). These currents create poles equal to the train's, which is pushed upward and floats about 10 cm.</p>
            <p class="mt-system__note">It only levitates while moving: it uses wheels up to about 100 to 150 km/h. In tests, it went past 600 km/h.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Attraction</span>
            <h3>Shanghai · Transrapid (EMS)</h3>
            <p>C-shaped arms wrap around the rail from below. Electromagnets are attracted upward, and sensors adjust the current thousands of times per second so the train neither sticks nor falls.</p>
            <p class="mt-system__note">It levitates from the start, without wheels, with a computer-controlled gap of 1 to 1.5 cm.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Superconductor</span>
            <h3>Brazil · MagLev-Cobra</h3>
            <p>Superconducting blocks, cooled with liquid nitrogen, float above a track of neodymium magnets. The superconductor "locks" the field and stays stable on its own.</p>
            <p class="mt-system__note">Developed at LASUP, at COPPE/UFRJ.</p>
          </article>
        </div>
      </section>
      <section class="mt-card mt-card--tint" aria-labelledby="mt-linear">
        <h2 id="mt-linear">And how does the train move? The linear motor</h2>
        <p>Imagine the motor of a fan "unrolled" along the whole track. The coils of the track keep switching poles: the coil ahead of the train attracts it, and the one behind repels it. This magnetic wave travels along the guideway, and the train, with no friction against the track, goes along with it.</p>
        <p><strong>Think of a line of people:</strong> the person ahead pulls your hand and the one behind pushes your back, over and over, very fast.</p>
      </section>
      <section class="mt-card" aria-labelledby="mt-world">
        <h2 id="mt-world">Where Maglevs are and what tips the scales</h2>
        <p class="mt-muted">Today, Maglev trains carry passengers only in China and Japan. Shanghai has the only high-speed line in operation, from Pudong airport to the metro. Japan is building the Chuo Shinkansen, which will link Tokyo to Nagoya (286 km) in about 40 minutes. The United Kingdom and South Korea once had commercial lines, but they were closed.</p>
        <div class="mt-systems mt-systems--two">
          <article class="mt-system">
            <span class="mt-system__tag">Advantages</span>
            <h3>Fast, efficient and quiet</h3>
            <p>Without touching the track, the train only faces air resistance: it gets faster and uses less energy at high speed.</p>
            <p>With no contact, the parts barely wear out, maintenance is lower and the noise is much lower than that of regular trains and airplanes.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Challenges</span>
            <h3>Expensive, with its own guideway</h3>
            <p>The guideway costs much more than a regular railway, because of the high-precision magnetic control.</p>
            <p>Existing tracks cannot be used: the whole line has to be built from scratch.</p>
            <p class="mt-system__note">It can replace airplanes on medium-length trips and relieve highways and airports.</p>
          </article>
        </div>
      </section>`;

  const ES_BODY = `
      <section class="mt-card" aria-labelledby="mt-systems">
        <h2 id="mt-systems">Tres formas de hacer que un tren flote</h2>
        <p class="mt-muted">Todo Maglev necesita levitar (quedar suspendido), ser guiado (no desviarse hacia los lados de la vía) y ser empujado hacia delante. Para flotar quieto, la fuerza magnética ascendente tiene que cancelar el peso. Cada sistema resuelve de un modo el problema de que los imanes por sí solos no son estables.</p>
        <div class="mt-systems">
          <article class="mt-system">
            <span class="mt-system__tag">Repulsión</span>
            <h3>Japón · SCMaglev (EDS)</h3>
            <p>Imanes superconductores en el tren, enfriados con helio líquido, inducen corrientes en las bobinas del raíl (ley de Faraday). Esas corrientes crean polos iguales a los del tren, que es empujado hacia arriba y flota unos 10 cm.</p>
            <p class="mt-system__note">Solo levita en movimiento: usa ruedas hasta unos 100 a 150 km/h. En las pruebas superó los 600 km/h.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Atracción</span>
            <h3>Shanghái · Transrapid (EMS)</h3>
            <p>Brazos en forma de C abrazan el raíl por debajo. Los electroimanes son atraídos hacia arriba y los sensores ajustan la corriente miles de veces por segundo para que el tren ni se pegue ni caiga.</p>
            <p class="mt-system__note">Levita desde el arranque, sin ruedas, con una holgura de 1 a 1,5 cm controlada por ordenador.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Superconductor</span>
            <h3>Brasil · MagLev-Cobra</h3>
            <p>Bloques superconductores, enfriados con nitrógeno líquido, flotan sobre un raíl de imanes de neodimio. El superconductor "fija" el campo y se mantiene estable por sí solo.</p>
            <p class="mt-system__note">Desarrollado en el LASUP de la COPPE/UFRJ.</p>
          </article>
        </div>
      </section>
      <section class="mt-card mt-card--tint" aria-labelledby="mt-linear">
        <h2 id="mt-linear">¿Y cómo se mueve el tren? El motor lineal</h2>
        <p>Imagine el motor de un ventilador "desenrollado" a lo largo de todo el raíl. Las bobinas del raíl cambian de polo sin parar: la bobina por delante del tren lo atrae y la de detrás lo repele. Esta onda magnética recorre la vía y el tren, sin rozamiento con el raíl, la acompaña.</p>
        <p><strong>Piense en una fila:</strong> la persona de delante tira de tu mano y la de detrás te empuja la espalda, una y otra vez y muy rápido.</p>
      </section>
      <section class="mt-card" aria-labelledby="mt-world">
        <h2 id="mt-world">Dónde están los Maglev y qué pesa en la balanza</h2>
        <p class="mt-muted">Hoy, los trenes Maglev transportan pasajeros solo en China y Japón. En Shanghái está la única línea de alta velocidad en servicio, del aeropuerto de Pudong hasta el metro. Japón construye la Chuo Shinkansen, que unirá Tokio con Nagoya (286 km) en unos 40 minutos. El Reino Unido y Corea del Sur tuvieron líneas comerciales, pero fueron cerradas.</p>
        <div class="mt-systems mt-systems--two">
          <article class="mt-system">
            <span class="mt-system__tag">Ventajas</span>
            <h3>Rápido, económico y silencioso</h3>
            <p>Sin tocar el raíl, el tren solo se enfrenta a la resistencia del aire: es más rápido y consume menos energía a alta velocidad.</p>
            <p>Sin contacto, las piezas casi no se desgastan, el mantenimiento es menor y el ruido es mucho menor que el de los trenes y aviones habituales.</p>
          </article>
          <article class="mt-system">
            <span class="mt-system__tag">Desafíos</span>
            <h3>Caro y con vía propia</h3>
            <p>La vía cuesta mucho más que un ferrocarril convencional, debido al control magnético de alta precisión.</p>
            <p>No se pueden aprovechar las vías existentes: toda la línea tiene que construirse desde cero.</p>
            <p class="mt-system__note">Puede sustituir al avión en trayectos medios y descongestionar autopistas y aeropuertos.</p>
          </article>
        </div>
      </section>`;

  function render(app, section) {
    const media = app.media();
    section.innerHTML = `
      ${app.heading(page.id, L('Assista ao vídeo e leia o texto de apoio. As afirmações da próxima página usam este conteúdo.', 'Watch the video and read the support text. The statements on the next page use this content.', 'Mira el vídeo y lee el texto de apoyo. Las afirmaciones de la página siguiente usan este contenido.'))}
      ${app.video('meissner', media.meissnerVideoUrl, media.meissnerVideoTitle || L('Trens de levitação magnética', 'Magnetic levitation trains', 'Trenes de levitación magnética'), 2, L('O conteúdo abaixo continua disponível caso o player seja bloqueado.', 'The content below is still available if the player is blocked.', 'El contenido siguiente sigue disponible si se bloquea el reproductor.'))}
      <section class="mt-card mt-transcript" aria-labelledby="transcript-title">
        <span class="mt-transcript__icon" aria-hidden="true">🧲</span>
        <div>
          <span class="mt-eyebrow">${L('Texto de apoio', 'Support text', 'Texto de apoyo')}</span>
          <h2 id="transcript-title">${L('O que o vídeo mostra', 'What the video shows', 'Lo que muestra el vídeo')}</h2>
          <div class="mt-prose">${plainMarkup(app.text('page6Transcript'))}</div>
        </div>
      </section>
      ${L(PT_BODY, EN_BODY, ES_BODY)}
    `;
  }

  const page = {
    id: 6,
    short: 'Maglev',
    get title() { return L('Como o Maglev flutua e anda', 'How the Maglev floats and moves', 'Cómo flota y se mueve el Maglev'); },
    unlockHint: '',
    render
  };

  (ns.pages = ns.pages || []).push(page);
})(window.H5P = window.H5P || {});
