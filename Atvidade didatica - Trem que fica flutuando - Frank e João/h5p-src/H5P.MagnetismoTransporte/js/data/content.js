(function (H5P) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Didactic content of "Magnetismo e Transporte" that is safe to ship
   * in plain text: concepts, extended review, links and memory cards.
   * Questions and answers live in authoring/banco-de-questoes.json and
   * reach the package sealed, through js/data/bank.js (generated).
   * Accessible language, aligned with the Magnetism / Electromagnetism
   * topics of the Physics textbooks distributed by PNLD (FNDE).
   * The English (en-US) texts are at the end of the file: each translated
   * field becomes a getter that follows the interface language, so the
   * pages read CONCEPTS[id].label, section.title… as before.
   * ------------------------------------------------------------------ */

  const I18n = H5P.MagnetismoTransporte.I18n;

  const CONCEPTS = {
    polos: { label: 'Ímãs e polos', review: 'polos' },
    dominios: { label: 'Domínios magnéticos', review: 'dominios' },
    campo: { label: 'Campo magnético e linhas de campo', review: 'campo' },
    equilibrio: { label: 'Equilíbrio de forças', review: 'equilibrio' },
    earnshaw: { label: 'Por que ímãs sozinhos não levitam', review: 'earnshaw' },
    eletroima: { label: 'Eletroímã', review: 'eletroima' },
    inducao: { label: 'Indução e o Maglev japonês', review: 'inducao' },
    ems: { label: 'Levitação por atração (Xangai)', review: 'ems' },
    'motor-linear': { label: 'Motor linear', review: 'motor-linear' },
    supercondutor: { label: 'Supercondutores e o MagLev-Cobra', review: 'supercondutor' },
    'maglev-mundo': { label: 'Maglev no mundo: vantagens e desafios', review: 'maglev-mundo' }
  };

  const PNLD_PORTAL = 'https://pnld.fnde.gov.br';
  const PNLD_PROGRAM = 'https://www.gov.br/fnde/pt-br/acesso-a-informacao/acoes-e-programas/programas/programas-do-livro';

  const LINKS = {
    phetMagnets: { label: 'PhET: Ímãs e Eletroímãs', url: 'https://phet.colorado.edu/pt_BR/simulations/magnets-and-electromagnets' },
    phetCompass: { label: 'PhET: Ímã e Bússola', url: 'https://phet.colorado.edu/pt_BR/simulations/magnet-and-compass' },
    phetFaraday: { label: 'PhET: Lei de Faraday', url: 'https://phet.colorado.edu/pt_BR/simulations/faradays-law' },
    phetFaradayLab: { label: 'PhET: Laboratório Eletromagnético de Faraday', url: 'https://phet.colorado.edu/pt_BR/simulations/faradays-electromagnetic-lab' },
    phetForces: { label: 'PhET: Forças e Movimento', url: 'https://phet.colorado.edu/pt_BR/simulations/forces-and-motion-basics' },
    cobra: { label: 'Site do MagLev-Cobra (COPPE/UFRJ)', url: 'http://www.maglevcobra.coppe.ufrj.br/' }
  };

  // Extended review tab. "book" = where to look in the PNLD Physics book;
  // "page" = page of this activity where the topic appears.
  const REVIEW_SECTIONS = [
    {
      id: 'polos',
      title: 'Ímãs e polos',
      summary: 'Todo ímã tem polo norte e polo sul. Iguais se repelem, diferentes se atraem.',
      body: [
        'Os polos são as regiões onde o efeito do ímã é mais forte. Se você pendurar um ímã em barra por um fio, ele gira até um dos polos apontar para o norte geográfico: esse é o polo norte do ímã.',
        'Os polos nunca aparecem sozinhos. Se você quebrar um ímã ao meio, cada pedaço vira um novo ímã completo, com norte e sul.'
      ],
      example: 'Ímãs de geladeira, fones de ouvido e motores de brinquedo usam essa atração e repulsão.',
      book: 'Capítulo de Magnetismo: "ímãs", "polos magnéticos", "atração e repulsão".',
      page: 3,
      links: ['phetCompass']
    },
    {
      id: 'dominios',
      title: 'Domínios magnéticos: de onde vem o magnetismo',
      summary: 'Um ímã é feito de bilhões de minúsculos ímãs atômicos alinhados.',
      body: [
        'Em materiais como ferro, níquel e cobalto, cada átomo funciona como um ímã minúsculo. Esses átomos se organizam em blocos chamados domínios magnéticos.',
        'No ferro comum, os domínios apontam para todos os lados e um cancela o outro. No ímã de neodímio, os domínios foram forçados a ficar alinhados: seus efeitos se somam e aparecem os polos norte e sul.'
      ],
      example: 'Esfregar um prego num ímã, sempre no mesmo sentido, alinha parte dos domínios e o prego vira um ímã fraco.',
      book: 'Capítulo de Magnetismo: "materiais ferromagnéticos" e "domínios magnéticos".',
      page: 2,
      links: ['phetMagnets']
    },
    {
      id: 'campo',
      title: 'Campo magnético e linhas de campo',
      summary: 'O ímã age à distância por meio do campo magnético, desenhado com linhas que saem do norte e entram no sul.',
      body: [
        'A força magnética não age "do nada": o ímã modifica o espaço à sua volta, criando um campo magnético. Ele é representado pelo vetor B.',
        'As linhas de campo saem do polo norte e entram no polo sul. Onde as linhas estão mais juntas, perto do ímã, o campo é mais forte. É por isso que a repulsão aumenta tanto quando dois ímãs chegam bem perto.',
        'Quando há vários ímãs, o campo em cada ponto é a soma dos campos de todos eles, como você viu ao girar os ímãs do laboratório.'
      ],
      example: 'A agulha de uma bússola é um pequeno ímã que se alinha ao campo magnético da Terra.',
      book: 'Capítulo de Magnetismo: "campo magnético", "linhas de campo" e "bússola".',
      page: 3,
      links: ['phetCompass', 'phetMagnets']
    },
    {
      id: 'equilibrio',
      title: 'Flutuar é equilibrar forças',
      summary: 'Para flutuar parado, a força magnética para cima precisa cancelar o peso.',
      body: [
        'Pela Primeira Lei de Newton, um objeto fica parado quando a força resultante sobre ele é zero.',
        'Quem puxa o objeto para baixo é o peso, P = m · g. Para ele flutuar, a força magnética precisa apontar para cima com o mesmo tamanho do peso.'
      ],
      example: 'Uma balança parada, com o mesmo peso nos dois pratos, também está em equilíbrio.',
      book: 'Capítulo de Leis de Newton: "força resultante", "peso" e "equilíbrio".',
      page: 6,
      links: ['phetForces']
    },
    {
      id: 'earnshaw',
      title: 'Por que ímãs sozinhos não fazem nada flutuar parado',
      summary: 'Com ímãs permanentes, o objeto sempre escapa para o lado (Teorema de Earnshaw).',
      body: [
        'Coloque um ímã sobre outro, com polos iguais frente a frente: ele escorrega para o lado e vira. Em 1842, Samuel Earnshaw mostrou que é impossível criar um equilíbrio estável só com ímãs permanentes.',
        'Por isso, em brinquedos que levitam, o objeto fica preso a um eixo ou gira como um pião. Os trens resolvem o problema de outro jeito: com eletroímãs controlados por computador ou com supercondutores.'
      ],
      example: 'O "Levitron" é um pião magnético que só flutua enquanto está girando.',
      book: 'Capítulo de Magnetismo ou de aplicações do eletromagnetismo (quadros sobre levitação e trens Maglev).',
      page: 3,
      links: []
    },
    {
      id: 'eletroima',
      title: 'Eletroímã: eletricidade que vira magnetismo',
      summary: 'Corrente elétrica numa bobina cria um campo magnético que pode ser ligado, desligado e ajustado.',
      body: [
        'Em 1820, Oersted percebeu que a corrente elétrica num fio desviava a agulha de uma bússola. Corrente elétrica produz campo magnético.',
        'Enrolando o fio numa bobina, o campo fica parecido com o de um ímã em barra: isso é um eletroímã. A diferença é que sua força muda na hora, conforme a corrente.'
      ],
      example: 'Guindastes de ferro-velho usam eletroímãs para levantar e soltar sucata.',
      book: 'Capítulo de Eletromagnetismo: "experimento de Oersted", "bobina", "solenoide" e "eletroímã".',
      page: 6,
      links: ['phetMagnets']
    },
    {
      id: 'inducao',
      title: 'Indução e o Maglev japonês (EDS)',
      summary: 'Ímãs em movimento induzem correntes no trilho, e essas correntes empurram o trem para cima.',
      body: [
        'O SCMaglev japonês usa a Suspensão Eletrodinâmica (EDS). O trem tem ímãs supercondutores muito fortes, e o trilho tem bobinas de metal.',
        'Quando o trem passa, seu campo magnético induz corrente elétrica nas bobinas (Lei de Faraday). Essa corrente cria um campo com a mesma polaridade do ímã do trem, e polos iguais se repelem: o trem é empurrado para cima e flutua cerca de 10 cm acima da via.',
        'Como a corrente depende do movimento, o trem usa rodas de borracha até ganhar velocidade, por volta de 100 a 150 km/h. Os ímãs supercondutores do trem japonês são resfriados com hélio líquido. Em 2015, um protótipo chegou a 603 km/h.'
      ],
      example: 'A mesma indução acontece no dínamo de bicicleta, que acende o farol enquanto a roda gira.',
      book: 'Capítulo de Eletromagnetismo: "indução eletromagnética" e "Lei de Faraday".',
      page: 6,
      links: ['phetFaraday', 'phetFaradayLab']
    },
    {
      id: 'ems',
      title: 'Levitação por atração: o trem de Xangai (EMS)',
      summary: 'O trem "abraça" o trilho por baixo e é puxado para cima por eletroímãs controlados por computador.',
      body: [
        'O Transrapid, usado em Xangai, usa a Suspensão Eletromagnética (EMS). Braços em forma de C abraçam o trilho, com eletroímãs embaixo dele. Ligados, os eletroímãs são atraídos para cima, em direção ao trilho de aço.',
        'Por que o trem não gruda de vez no trilho? Sensores medem a distância milhares de vezes por segundo. Se o trem chega perto demais, o computador diminui a corrente; se ele começa a cair, aumenta. Assim, a folga fica entre 1 e 1,5 centímetro, e o trem levita desde a partida, sem usar rodas.'
      ],
      example: 'É parecido com equilibrar uma vassoura na palma da mão: pequenas correções o tempo todo.',
      book: 'Capítulo de Eletromagnetismo (aplicações do eletroímã).',
      page: 6,
      links: ['phetMagnets']
    },
    {
      id: 'motor-linear',
      title: 'Motor linear: como o trem anda sem rodas',
      summary: 'Bobinas do trilho trocam de polo sem parar: a da frente puxa e a de trás empurra.',
      body: [
        'Um motor elétrico comum gira porque seus ímãs trocam de polaridade em volta de um eixo. No Maglev, esse motor foi "desenrolado" ao longo do trilho: é o motor linear.',
        'Com corrente alternada, a bobina à frente do trem vira um polo oposto ao do trem e o puxa, enquanto a bobina logo atrás vira um polo igual e o empurra. Essa onda magnética percorre o trilho, e o trem, sem atrito com a via, vai junto.'
      ],
      example: 'Imagine uma fila de pessoas: a da frente puxa sua mão e a de trás empurra suas costas, repetidas vezes e bem rápido.',
      book: 'Capítulo de Eletromagnetismo: "motor elétrico" e "corrente alternada".',
      page: 6,
      links: ['phetFaradayLab']
    },
    {
      id: 'supercondutor',
      title: 'Supercondutores e o MagLev-Cobra',
      summary: 'Resfriado com nitrogênio líquido, o supercondutor "prende" o ímã no lugar e flutua de forma estável.',
      body: [
        'Alguns materiais cerâmicos, como o YBCO, viram supercondutores quando ficam muito frios. O nitrogênio líquido, a cerca de −196 °C, faz esse resfriamento; ele não reage com o material, só resfria.',
        'Resfriado, o supercondutor expulsa parte do campo magnético (Efeito Meissner) e prende o restante no lugar. Por isso ele flutua sobre um trilho de ímãs de forma estável, sem precisar de computador.',
        'O MagLev-Cobra, trem brasileiro desenvolvido no LASUP da COPPE/UFRJ, usa esse princípio sobre um trilho de ímãs de neodímio.'
      ],
      example: 'É o fenômeno mostrado nos vídeos em que uma pastilha fumegante flutua sobre um trilho de ímãs.',
      book: 'Quadros de leitura sobre supercondutividade e tecnologia, no capítulo de Magnetismo ou Eletromagnetismo.',
      page: 5,
      links: ['cobra']
    },
    {
      id: 'maglev-mundo',
      title: 'Maglev no mundo: vantagens e desafios',
      summary: 'Um Maglev levita, é guiado e é empurrado por ímãs. É rápido e silencioso, mas caro de construir.',
      body: [
        'Todo trem Maglev combina três sistemas: a levitação, que o deixa suspenso sem atrito; o guiamento, que o mantém alinhado sem escapar para os lados; e a propulsão, feita pelo motor linear.',
        'Hoje, só a China e o Japão têm Maglevs levando passageiros. Xangai tem a única linha de alta velocidade em operação, e o Japão constrói a Chuo Shinkansen, entre Tóquio e Nagoia. As linhas do Reino Unido e da Coreia do Sul fecharam por custo alto, falta de peças e pouca procura.',
        'Pontos fortes: mais velocidade, menos gasto de energia, pouco desgaste e pouco barulho, tudo porque o trem não encosta na via. Pontos fracos: a via é muito cara e não aproveita os trilhos das ferrovias comuns.'
      ],
      example: 'Numa viagem média, como Tóquio–Nagoia, o Maglev compete com o avião e ajuda a desafogar rodovias e aeroportos.',
      book: 'Quadros de ciência, tecnologia e sociedade nos capítulos de Eletromagnetismo (aplicações e impactos da tecnologia nos transportes).',
      page: 6,
      links: []
    }
  ];

  // Page 5 — memory cards. Card 2i shows the image of pair i and card 2i+1
  // its description. Completion is worth 1 point whatever the number of
  // moves, so the pairing itself needs no protection.
  const MEMORY_PAIRS = [
    { id: 'ybco', concept: 'supercondutor', image: 'ybco.jpg', alt: 'Amostra cerâmica de YBCO apoiada sobre uma superfície', label: 'Supercondutor: resfriado, ele "prende" o ímã no lugar', shortLabel: 'Bloco cerâmico de YBCO' },
    { id: 'magnet', concept: 'dominios', image: 'magnet.jpg', alt: 'Ímã retangular prateado', label: 'Ímã de neodímio: domínios magnéticos alinhados', shortLabel: 'Ímã retangular prateado' },
    { id: 'nitrogen', concept: 'supercondutor', image: 'liquid-nitrogen.png', alt: 'Supercondutor sendo resfriado em um experimento com nitrogênio líquido', label: 'Nitrogênio líquido resfria o supercondutor (−196 °C)', shortLabel: 'Vaso com nuvem de vapor branco' },
    { id: 'cobra', concept: 'supercondutor', image: 'maglev-cobra.jpg', alt: 'Fotografia do protótipo do MagLev-Cobra sobre uma via de teste', label: 'MagLev-Cobra: trem brasileiro da UFRJ', shortLabel: 'Protótipo do MagLev-Cobra' },
    { id: 'solar', concept: null, image: 'solar-panel.svg', alt: 'Ilustração de um painel solar sob o sol', label: 'Energia solar pode alimentar os eletroímãs', shortLabel: 'Painel solar' },
    { id: 'leaf', concept: null, image: 'sustainability.svg', alt: 'Ilustração de uma folha e da Terra com sinal de renovação', label: 'Sem fumaça: transporte elétrico mais limpo', shortLabel: 'Ícone de folha e sustentabilidade' }
  ];

  /* ------------------------------ English ------------------------------ */

  const EN_CONCEPTS = {
    polos: 'Magnets and poles',
    dominios: 'Magnetic domains',
    campo: 'Magnetic field and field lines',
    equilibrio: 'Balance of forces',
    earnshaw: 'Why magnets alone do not levitate',
    eletroima: 'Electromagnet',
    inducao: 'Induction and the Japanese Maglev',
    ems: 'Levitation by attraction (Shanghai)',
    'motor-linear': 'Linear motor',
    supercondutor: 'Superconductors and the MagLev-Cobra',
    'maglev-mundo': 'Maglev around the world: advantages and challenges'
  };

  const EN_LINKS = {
    phetMagnets: { label: 'PhET: Magnets and Electromagnets', url: 'https://phet.colorado.edu/en/simulations/magnets-and-electromagnets' },
    phetCompass: { label: 'PhET: Magnet and Compass', url: 'https://phet.colorado.edu/en/simulations/magnet-and-compass' },
    phetFaraday: { label: "PhET: Faraday's Law", url: 'https://phet.colorado.edu/en/simulations/faradays-law' },
    phetFaradayLab: { label: "PhET: Faraday's Electromagnetic Lab", url: 'https://phet.colorado.edu/en/simulations/faradays-electromagnetic-lab' },
    phetForces: { label: 'PhET: Forces and Motion: Basics', url: 'https://phet.colorado.edu/en/simulations/forces-and-motion-basics' },
    cobra: { label: 'MagLev-Cobra website (COPPE/UFRJ, in Portuguese)' }
  };

  const EN_REVIEW = {
    polos: {
      title: 'Magnets and poles',
      summary: 'Every magnet has a north pole and a south pole. Like poles repel, opposite poles attract.',
      body: [
        'The poles are the regions where the effect of the magnet is strongest. If you hang a bar magnet from a string, it turns until one of its poles points to geographic north: that is the north pole of the magnet.',
        'Poles never appear alone. If you break a magnet in half, each piece becomes a new complete magnet, with a north and a south pole.'
      ],
      example: 'Fridge magnets, headphones and toy motors use this attraction and repulsion.',
      book: 'Magnetism chapter: "magnets", "magnetic poles", "attraction and repulsion".'
    },
    dominios: {
      title: 'Magnetic domains: where magnetism comes from',
      summary: 'A magnet is made of billions of tiny aligned atomic magnets.',
      body: [
        'In materials such as iron, nickel and cobalt, each atom works like a tiny magnet. These atoms are organized into blocks called magnetic domains.',
        'In ordinary iron, the domains point in every direction and cancel each other out. In a neodymium magnet, the domains were forced to line up: their effects add up and the north and south poles appear.'
      ],
      example: 'Rubbing a nail on a magnet, always in the same direction, aligns some of the domains and the nail becomes a weak magnet.',
      book: 'Magnetism chapter: "ferromagnetic materials" and "magnetic domains".'
    },
    campo: {
      title: 'Magnetic field and field lines',
      summary: 'A magnet acts at a distance through its magnetic field, drawn with lines that leave the north pole and enter the south pole.',
      body: [
        'The magnetic force does not act "out of nowhere": the magnet changes the space around it, creating a magnetic field. It is represented by the vector B.',
        'Field lines leave the north pole and enter the south pole. Where the lines are closer together, near the magnet, the field is stronger. That is why the repulsion grows so much when two magnets get very close.',
        'When there are several magnets, the field at each point is the sum of the fields of all of them, as you saw when you rotated the magnets in the lab.'
      ],
      example: 'The needle of a compass is a small magnet that lines up with the magnetic field of the Earth.',
      book: 'Magnetism chapter: "magnetic field", "field lines" and "compass".'
    },
    equilibrio: {
      title: 'Floating means balancing forces',
      summary: 'To float still, the upward magnetic force must cancel the weight.',
      body: [
        "By Newton's First Law, an object stays still when the net force on it is zero.",
        'What pulls the object down is its weight, W = m · g. For it to float, the magnetic force must point upward with the same size as the weight.'
      ],
      example: 'A balance scale at rest, with the same weight on both pans, is also in equilibrium.',
      book: 'Newton\'s Laws chapter: "net force", "weight" and "equilibrium".'
    },
    earnshaw: {
      title: 'Why magnets alone cannot make anything float still',
      summary: "With permanent magnets, the object always slips away to the side (Earnshaw's theorem).",
      body: [
        'Place one magnet above another, with like poles facing each other: it slides to the side and flips over. In 1842, Samuel Earnshaw showed that it is impossible to create a stable equilibrium with permanent magnets alone.',
        'That is why, in levitating toys, the object is held on an axis or spins like a top. Trains solve the problem another way: with computer-controlled electromagnets or with superconductors.'
      ],
      example: 'The "Levitron" is a magnetic spinning top that only floats while it is spinning.',
      book: 'Magnetism chapter or chapter on applications of electromagnetism (boxes about levitation and Maglev trains).'
    },
    eletroima: {
      title: 'Electromagnet: electricity that becomes magnetism',
      summary: 'Electric current in a coil creates a magnetic field that can be switched on, switched off and adjusted.',
      body: [
        'In 1820, Oersted noticed that the electric current in a wire deflected the needle of a compass. Electric current produces a magnetic field.',
        'When the wire is wound into a coil, the field looks like that of a bar magnet: this is an electromagnet. The difference is that its strength changes instantly, following the current.'
      ],
      example: 'Scrapyard cranes use electromagnets to lift and drop scrap metal.',
      book: 'Electromagnetism chapter: "Oersted\'s experiment", "coil", "solenoid" and "electromagnet".'
    },
    inducao: {
      title: 'Induction and the Japanese Maglev (EDS)',
      summary: 'Moving magnets induce currents in the guideway, and these currents push the train upward.',
      body: [
        'The Japanese SCMaglev uses Electrodynamic Suspension (EDS). The train has very strong superconducting magnets, and the guideway has metal coils.',
        "When the train passes, its magnetic field induces electric current in the coils (Faraday's Law). This current creates a field with the same polarity as the train's magnet, and like poles repel: the train is pushed upward and floats about 10 cm above the guideway.",
        'Because the current depends on motion, the train uses rubber wheels until it gains speed, around 100 to 150 km/h. The superconducting magnets of the Japanese train are cooled with liquid helium. In 2015, a prototype reached 603 km/h.'
      ],
      example: 'The same induction happens in a bicycle dynamo, which lights the headlamp while the wheel turns.',
      book: 'Electromagnetism chapter: "electromagnetic induction" and "Faraday\'s Law".'
    },
    ems: {
      title: 'Levitation by attraction: the Shanghai train (EMS)',
      summary: 'The train "hugs" the rail from below and is pulled upward by computer-controlled electromagnets.',
      body: [
        'The Transrapid, used in Shanghai, uses Electromagnetic Suspension (EMS). C-shaped arms wrap around the rail, with electromagnets underneath it. When switched on, the electromagnets are attracted upward, toward the steel rail.',
        'Why does the train not simply stick to the rail? Sensors measure the distance thousands of times per second. If the train gets too close, the computer lowers the current; if it starts to drop, it raises it. This keeps the gap between 1 and 1.5 centimeters, and the train levitates from the start, without using wheels.'
      ],
      example: 'It is like balancing a broom on the palm of your hand: small corrections all the time.',
      book: 'Electromagnetism chapter (applications of the electromagnet).'
    },
    'motor-linear': {
      title: 'Linear motor: how the train moves without wheels',
      summary: 'Coils in the guideway keep switching poles: the one ahead pulls and the one behind pushes.',
      body: [
        'A regular electric motor turns because its magnets switch polarity around an axis. In a Maglev, this motor has been "unrolled" along the guideway: it is the linear motor.',
        'With alternating current, the coil ahead of the train becomes a pole opposite to the train\'s and pulls it, while the coil just behind becomes a like pole and pushes it. This magnetic wave travels along the guideway, and the train, with no friction against the track, goes along with it.'
      ],
      example: 'Imagine a line of people: the person ahead pulls your hand and the one behind pushes your back, over and over, very fast.',
      book: 'Electromagnetism chapter: "electric motor" and "alternating current".'
    },
    supercondutor: {
      title: 'Superconductors and the MagLev-Cobra',
      summary: 'Cooled with liquid nitrogen, the superconductor "locks" the magnet in place and floats stably.',
      body: [
        'Some ceramic materials, such as YBCO, become superconductors when they get very cold. Liquid nitrogen, at about −196 °C, does this cooling; it does not react with the material, it only cools it.',
        'Once cooled, the superconductor expels part of the magnetic field (Meissner effect) and locks the rest in place. That is why it floats stably above a track of magnets, with no need for a computer.',
        'The MagLev-Cobra, a Brazilian train developed at LASUP, at COPPE/UFRJ, uses this principle over a track of neodymium magnets.'
      ],
      example: 'It is the phenomenon shown in videos where a smoking pellet floats above a track of magnets.',
      book: 'Reading boxes about superconductivity and technology, in the Magnetism or Electromagnetism chapter.'
    },
    'maglev-mundo': {
      title: 'Maglev around the world: advantages and challenges',
      summary: 'A Maglev is levitated, guided and pushed by magnets. It is fast and quiet, but expensive to build.',
      body: [
        'Every Maglev train combines three systems: levitation, which keeps it suspended with no friction; guidance, which keeps it aligned without drifting sideways; and propulsion, provided by the linear motor.',
        'Today, only China and Japan have Maglevs carrying passengers. Shanghai has the only high-speed line in operation, and Japan is building the Chuo Shinkansen, between Tokyo and Nagoya. The lines in the United Kingdom and South Korea closed because of high costs, lack of parts and low demand.',
        'Strengths: more speed, lower energy use, little wear and little noise, all because the train does not touch the guideway. Weaknesses: the guideway is very expensive and cannot reuse the tracks of regular railways.'
      ],
      example: 'On a medium-length trip, such as Tokyo–Nagoya, the Maglev competes with airplanes and helps relieve highways and airports.',
      book: 'Science, technology and society boxes in the Electromagnetism chapters (applications and impacts of technology on transportation).'
    }
  };

  const EN_MEMORY = {
    ybco: { alt: 'Ceramic YBCO sample resting on a surface', label: 'Superconductor: once cooled, it "locks" the magnet in place', shortLabel: 'Ceramic YBCO block' },
    magnet: { alt: 'Silver rectangular magnet', label: 'Neodymium magnet: aligned magnetic domains', shortLabel: 'Silver rectangular magnet' },
    nitrogen: { alt: 'Superconductor being cooled in an experiment with liquid nitrogen', label: 'Liquid nitrogen cools the superconductor (−196 °C)', shortLabel: 'Vessel with a cloud of white vapor' },
    cobra: { alt: 'Photograph of the MagLev-Cobra prototype on a test track', label: 'MagLev-Cobra: Brazilian train from UFRJ', shortLabel: 'MagLev-Cobra prototype' },
    solar: { alt: 'Illustration of a solar panel under the sun', label: 'Solar energy can power the electromagnets', shortLabel: 'Solar panel' },
    leaf: { alt: 'Illustration of a leaf and the Earth with a renewal sign', label: 'No smoke: cleaner electric transportation', shortLabel: 'Leaf and sustainability icon' }
  };

  // Turns each field present in `english` into a getter that returns the
  // English text when the interface is in en-US, and the original otherwise.
  function localize(target, english) {
    Object.keys(english || {}).forEach((field) => {
      const original = target[field];
      const translated = english[field];
      Object.defineProperty(target, field, {
        enumerable: true,
        get: () => (I18n.isEnglish() ? translated : original)
      });
    });
  }

  Object.keys(CONCEPTS).forEach((id) => localize(CONCEPTS[id], { label: EN_CONCEPTS[id] }));
  Object.keys(LINKS).forEach((key) => localize(LINKS[key], EN_LINKS[key]));
  REVIEW_SECTIONS.forEach((section) => localize(section, EN_REVIEW[section.id]));
  MEMORY_PAIRS.forEach((pair) => localize(pair, EN_MEMORY[pair.id]));

  H5P.MagnetismoTransporte = H5P.MagnetismoTransporte || {};
  H5P.MagnetismoTransporte.Content = {
    CONCEPTS,
    REVIEW_SECTIONS,
    LINKS,
    PNLD_PORTAL,
    PNLD_PROGRAM,
    MEMORY_PAIRS
  };
})(window.H5P = window.H5P || {});
