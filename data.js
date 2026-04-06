
const DEFAULT_DATA = {
  config: {
    fifa: {
      weights: {
        league: 1,
        playoff: 1.5,
        final: 2,
        friendly: 0.3
      },
      bonus: {
        champion: 50,
        runnerUp: 25,
        third: 10
      }
    },
    discipline: {
      yellowPerMatchSuspension: 2,
      yellowAccumulationSuspension: 3
    }
  },

  rules: [
    {
      id: "rule_1",
      title: "Expulsión por doble amarilla",
      text: "Un jugador o DT que reciba 2 tarjetas amarillas en el mismo partido será expulsado.",
      active: true
    },
    {
      id: "rule_2",
      title: "Suspensión por acumulación",
      text: "Un jugador o DT que acumule 3 tarjetas amarillas será suspendido para el siguiente partido.",
      active: true
    },
    {
      id: "rule_3",
      title: "Amistosos y ranking FIFA",
      text: "Los amistosos cuentan para el ranking FIFA con un peso muy bajo.",
      active: true
    },
    {
      id: "rule_4",
      title: "Divisiones automáticas",
      text: "Las divisiones se forman automáticamente con el ranking FIFA: top 3 a División A y bottom 3 a División B.",
      active: true
    },
    {
      id: "rule_5",
      title: "Finales divisionales",
      text: "En torneos divisionales, el primer y segundo lugar de cada división juegan una final de su propia división.",
      active: true
    }
  ],

  participants: [
    { id: "participante_alvaro", name: "Álvaro", color: "#e74c3c" },
    { id: "participante_carlos", name: "Carlos", color: "#3498db" }
  ],

  teams: [
    {
      id: "polpetta",
      name: "Sportivo La Polpetta",
      coach: "Giuseppe Perlatore",
      players: [
        ["Vito Volta","Arquero"],
        ["Enzo Mancini","Defensa"],
        ["Fabio Clemenza","Defensa"],
        ["Giorgio Valentino","Defensa"],
        ["Rocco Carusso","Defensa"],
        ["Donnie Spumoni","Medio"],
        ["Fiorino Panicucci","Medio"],
        ["Mario De Luca","Medio"],
        ["Milo Gorgazzi","Medio"],
        ["Alessandro Zito","Delantero"],
        ["Freddo Bellini","Delantero"],
        ["Giulio Locatelli","Delantero"],
        ["Nicola Pisani","Delantero"],
        ["Paolo Fontana","Delantero"]
      ]
    },
    {
      id: "guanaco",
      name: "C.S.D El Guanaco",
      coach: "Hank Romano",
      players: [
        ["Rosendo Acosta","Arquero"],
        ["Bo de la Rosa","Defensa"],
        ["Carmelo Wilkinson","Defensa"],
        ["Robbie Solomon","Defensa"],
        ["Warner Ferrera","Defensa"],
        ["Chuck Chong","Medio"],
        ["Donovan Vinson","Medio"],
        ["Harley Peralta","Medio"],
        ["Wilton Blackwood","Medio"],
        ["Davis Bronson","Delantero"],
        ["Irwin Medeiros","Delantero"],
        ["Lonny Ventura","Delantero"],
        ["Sid Koslowski","Delantero"],
        ["Sonny Saldana","Delantero"]
      ]
    },
    {
      id: "trucha",
      name: "Sporting La Trucha",
      coach: "Bruno Benítez",
      players: [
        ["Eddy Pino","Arquero"],
        ["Burt McCloskey","Defensa"],
        ["Dominic Mortensen","Defensa"],
        ["Donald Ortega","Defensa"],
        ["Mario Luna","Defensa"],
        ["Angelo Carboni","Medio"],
        ["Jerold Bogan","Medio"],
        ["Kelly Rivera","Medio"],
        ["Wilfredo Fernandez","Medio"],
        ["Boris Lentz","Delantero"],
        ["Dino Richi","Delantero"],
        ["Eric Perry","Delantero"],
        ["Faustino Soriano","Delantero"],
        ["Ricky Watkins","Delantero"]
      ]
    },
    {
      id: "pantera",
      name: "Atlético Pantera",
      coach: "Nina Taylor",
      players: [
        ["Rita Malone","Arquero"],
        ["Belinda Sparks","Defensa"],
        ["Mandy Wallace","Defensa"],
        ["Nora Cruz","Defensa"],
        ["Sabrina Mendoza","Defensa"],
        ["Lina Yamamoto","Medio"],
        ["Margaret Castillo","Medio"],
        ["Rebeca Sanders","Medio"],
        ["Sherry Terry","Medio"],
        ["Cindy Fitzgerald","Delantero"],
        ["Jackie Sanchez","Delantero"],
        ["Nancy King","Delantero"],
        ["Roxie Jones","Delantero"],
        ["Sharon Ortiz","Delantero"]
      ]
    },
    {
      id: "parrilla",
      name: "La Parrilla F.C.",
      coach: "Barry Mack",
      players: [
        ["Alex Meres","Arquero"],
        ["Arthur Turok","Defensa"],
        ["Freddy Manfredo","Defensa"],
        ["Joe Pavo","Defensa"],
        ["John Giovanni","Defensa"],
        ["Claudio Conde","Medio"],
        ["El Profesor","Medio"],
        ["Peta Zeta","Medio"],
        ["Rod Lete","Medio"],
        ["Rolando Akira","Medio"],
        ["El Guaton Nelson","Delantero"],
        ["Luis Felipe","Delantero"],
        ["Nick Cabezon","Delantero"],
        ["Randolph D'Luna","Delantero"]
      ]
    },
    {
      id: "perla",
      name: "La Perla United",
      coach: "Cornelius Waters",
      players: [
        ["Eusebio Flowers","Arquero"],
        ["Edison Cabrera","Defensa"],
        ["Jacinto Chavarria","Defensa"],
        ["Lucius Chase","Defensa"],
        ["Melvin Clayton","Defensa"],
        ["Archie Jackson","Medio"],
        ["Eric Reyes","Medio"],
        ["Sammy Portillo","Medio"],
        ["Toyo Takahashi","Medio"],
        ["El Kraken","Delantero"],
        ["Julio Vega","Delantero"],
        ["Marty Love","Delantero"],
        ["Omar Watson","Delantero"],
        ["Randolph Salazar","Delantero"],
        ["Steven Ramos","Delantero"]
      ]
    }
  ],

  classics: [
    { id:"superclasico", name:"El Superclásico", a:"polpetta", b:"perla" },
    { id:"clasico", name:"El Clásico", a:"trucha", b:"guanaco" },
    { id:"generos", name:"El Clásico de los Géneros", a:"pantera", b:"parrilla" }
  ],

  friendlies: [],

  discipline: {
    records: []
  },

  divisions: {
    A: [],
    B: []
  },

  fifaRanking: [],

  tournaments: [
    {
      id:"t1",
      name:"1er Torneo Apertura",
      type:"league_playoff",
      status:"historical",
      createdAt:"Historico",
      config:{legs:1},
      teamIds:["guanaco","polpetta","trucha","pantera","parrilla","perla"],
      manualStandings:[
        {teamId:"trucha", pj:5, pg:4, pe:1, pp:0, gf:11, gc:3, dg:8, pts:13, pos:1},
        {teamId:"parrilla", pj:5, pg:3, pe:1, pp:1, gf:6, gc:5, dg:1, pts:10, pos:2},
        {teamId:"polpetta", pj:5, pg:1, pe:3, pp:1, gf:4, gc:5, dg:-1, pts:6, pos:3},
        {teamId:"guanaco", pj:5, pg:1, pe:2, pp:2, gf:6, gc:8, dg:-2, pts:4, pos:4},
        {teamId:"perla", pj:5, pg:1, pe:1, pp:3, gf:3, gc:8, dg:-5, pts:4, pos:5},
        {teamId:"pantera", pj:5, pg:0, pe:2, pp:3, gf:3, gc:9, dg:-6, pts:2, pos:6}
      ],
      matches:[
        {id:"t1r1a",stage:"regular",round:"Fecha 1",label:"Partido 1",home:"guanaco",away:"perla",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r1b",stage:"regular",round:"Fecha 1",label:"Partido 2",home:"polpetta",away:"trucha",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r1c",stage:"regular",round:"Fecha 1",label:"Partido 3",home:"parrilla",away:"pantera",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r2a",stage:"regular",round:"Fecha 2",label:"Partido 1",home:"pantera",away:"polpetta",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r2b",stage:"regular",round:"Fecha 2",label:"Partido 2",home:"perla",away:"parrilla",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r2c",stage:"regular",round:"Fecha 2",label:"Partido 3",home:"guanaco",away:"trucha",homeGoals:2,awayGoals:4,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r3a",stage:"regular",round:"Fecha 3",label:"Partido 1",home:"pantera",away:"guanaco",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r3b",stage:"regular",round:"Fecha 3",label:"Partido 2",home:"polpetta",away:"parrilla",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r3c",stage:"regular",round:"Fecha 3",label:"Partido 3",home:"trucha",away:"perla",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r4a",stage:"regular",round:"Fecha 4",label:"Partido 1",home:"pantera",away:"trucha",homeGoals:0,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r4b",stage:"regular",round:"Fecha 4",label:"Partido 2",home:"perla",away:"polpetta",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r4c",stage:"regular",round:"Fecha 4",label:"Partido 3",home:"parrilla",away:"guanaco",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r5a",stage:"regular",round:"Fecha 5",label:"Partido 1",home:"guanaco",away:"polpetta",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r5b",stage:"regular",round:"Fecha 5",label:"Partido 2",home:"perla",away:"pantera",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1r5c",stage:"regular",round:"Fecha 5",label:"Partido 3",home:"trucha",away:"parrilla",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1s1i",stage:"knockout",round:"Semifinales",label:"Semifinal Ida",home:"trucha",away:"guanaco",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1s1v",stage:"knockout",round:"Semifinales",label:"Semifinal Vuelta",home:"guanaco",away:"trucha",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1s2i",stage:"knockout",round:"Semifinales",label:"Semifinal Ida",home:"parrilla",away:"polpetta",homeGoals:1,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1s2v",stage:"knockout",round:"Semifinales",label:"Semifinal Vuelta",home:"polpetta",away:"parrilla",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1tpi",stage:"knockout",round:"3er Lugar",label:"3er Puesto Ida",home:"trucha",away:"polpetta",homeGoals:3,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1tpv",stage:"knockout",round:"3er Lugar",label:"3er Puesto Vuelta",home:"polpetta",away:"trucha",homeGoals:4,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1fi",stage:"knockout",round:"Final",label:"Final Ida",home:"guanaco",away:"parrilla",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t1fv",stage:"knockout",round:"Final",label:"Final Vuelta",home:"parrilla",away:"guanaco",homeGoals:1,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"guanaco",
      runnerUp:"parrilla",
      third:"polpetta",
      playerScorers:[],
      playerAssists:[],
      participantLocal:"participante_alvaro",
      participantAway:"participante_carlos",
      participantChampion:"participante_alvaro",
      participantRunnerUp:"participante_carlos",
      participantThird:""
    },

    {
      id:"t2",
      name:"2do Torneo Clausura",
      type:"league_playoff",
      status:"historical",
      createdAt:"14 Oct 2022 / 12 Jun 2023",
      config:{legs:1},
      teamIds:["trucha","parrilla","polpetta","guanaco","perla","pantera"],
      matches:[
        {id:"t2j1a",stage:"regular",round:"Jornada 1",label:"Partido 1",home:"trucha",away:"parrilla",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j1b",stage:"regular",round:"Jornada 1",label:"Partido 2",home:"perla",away:"polpetta",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j1c",stage:"regular",round:"Jornada 1",label:"Partido 3",home:"guanaco",away:"pantera",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j2a",stage:"regular",round:"Jornada 2",label:"Partido 1",home:"guanaco",away:"trucha",homeGoals:3,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j2b",stage:"regular",round:"Jornada 2",label:"Partido 2",home:"parrilla",away:"perla",homeGoals:2,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j2c",stage:"regular",round:"Jornada 2",label:"Partido 3",home:"pantera",away:"polpetta",homeGoals:1,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j3a",stage:"regular",round:"Jornada 3",label:"Partido 1",home:"polpetta",away:"parrilla",homeGoals:3,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j3b",stage:"regular",round:"Jornada 3",label:"Partido 2",home:"perla",away:"guanaco",homeGoals:3,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j3c",stage:"regular",round:"Jornada 3",label:"Partido 3",home:"trucha",away:"pantera",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j4a",stage:"regular",round:"Jornada 4",label:"Partido 1",home:"pantera",away:"parrilla",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j4b",stage:"regular",round:"Jornada 4",label:"Partido 2",home:"guanaco",away:"polpetta",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j4c",stage:"regular",round:"Jornada 4",label:"Partido 3",home:"trucha",away:"perla",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j5a",stage:"regular",round:"Jornada 5",label:"Partido 1",home:"parrilla",away:"guanaco",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j5b",stage:"regular",round:"Jornada 5",label:"Partido 2",home:"polpetta",away:"trucha",homeGoals:4,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2j5c",stage:"regular",round:"Jornada 5",label:"Partido 3",home:"perla",away:"pantera",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2s1i",stage:"knockout",round:"Semifinales",label:"Semifinal 1 - Ida",home:"trucha",away:"guanaco",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2s1v",stage:"knockout",round:"Semifinales",label:"Semifinal 1 - Vuelta",home:"trucha",away:"guanaco",homeGoals:0,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2s2i",stage:"knockout",round:"Semifinales",label:"Semifinal 2 - Ida",home:"polpetta",away:"pantera",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2s2v",stage:"knockout",round:"Semifinales",label:"Semifinal 2 - Vuelta",home:"polpetta",away:"pantera",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2t",stage:"knockout",round:"3er Lugar",label:"3° y 4°",home:"pantera",away:"trucha",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t2f",stage:"knockout",round:"Final",label:"Final",home:"polpetta",away:"guanaco",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"polpetta",
      runnerUp:"guanaco",
      third:"trucha",
      playerScorers:[],
      playerAssists:[]
    },

    {
      id:"t3",
      name:"3er Torneo - Copa Gato Dulce",
      type:"cup_groups",
      status:"historical",
      createdAt:"Historico",
      config:{legs:2},
      teamIds:["polpetta","parrilla","perla","trucha","guanaco","pantera"],
      groups:[
        {name:"Grupo 1", teamIds:["polpetta","parrilla","perla"]},
        {name:"Grupo 2", teamIds:["trucha","guanaco","pantera"]}
      ],
      matches:[
        {id:"t3g1a",stage:"group",group:"Grupo 1",round:"Fecha 1",label:"Grupo 1",home:"polpetta",away:"parrilla",homeGoals:4,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g1b",stage:"group",group:"Grupo 1",round:"Fecha 2",label:"Grupo 1",home:"parrilla",away:"perla",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g1c",stage:"group",group:"Grupo 1",round:"Fecha 3",label:"Grupo 1",home:"perla",away:"polpetta",homeGoals:4,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g1d",stage:"group",group:"Grupo 1",round:"Fecha 4",label:"Grupo 1",home:"parrilla",away:"polpetta",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g1e",stage:"group",group:"Grupo 1",round:"Fecha 5",label:"Grupo 1",home:"perla",away:"parrilla",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g1f",stage:"group",group:"Grupo 1",round:"Fecha 6",label:"Grupo 1",home:"polpetta",away:"perla",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2a",stage:"group",group:"Grupo 2",round:"Fecha 1",label:"Grupo 2",home:"trucha",away:"guanaco",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2b",stage:"group",group:"Grupo 2",round:"Fecha 2",label:"Grupo 2",home:"guanaco",away:"pantera",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2c",stage:"group",group:"Grupo 2",round:"Fecha 3",label:"Grupo 2",home:"pantera",away:"trucha",homeGoals:2,awayGoals:4,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2d",stage:"group",group:"Grupo 2",round:"Fecha 4",label:"Grupo 2",home:"guanaco",away:"trucha",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2e",stage:"group",group:"Grupo 2",round:"Fecha 5",label:"Grupo 2",home:"pantera",away:"guanaco",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3g2f",stage:"group",group:"Grupo 2",round:"Fecha 6",label:"Grupo 2",home:"trucha",away:"pantera",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3s1i",stage:"knockout",round:"Semifinales",label:"Semifinal Ida",home:"polpetta",away:"pantera",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3s1v",stage:"knockout",round:"Semifinales",label:"Semifinal Vuelta",home:"pantera",away:"polpetta",homeGoals:0,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3s2i",stage:"knockout",round:"Semifinales",label:"Semifinal Ida",home:"perla",away:"trucha",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3s2v",stage:"knockout",round:"Semifinales",label:"Semifinal Vuelta",home:"trucha",away:"perla",homeGoals:2,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3t",stage:"knockout",round:"3er Lugar",label:"3er Puesto",home:"pantera",away:"perla",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3fi",stage:"knockout",round:"Final",label:"Final Ida",home:"polpetta",away:"trucha",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t3fv",stage:"knockout",round:"Final",label:"Final Vuelta",home:"trucha",away:"polpetta",homeGoals:1,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"polpetta",
      runnerUp:"trucha",
      third:"pantera",
      playerScorers:[],
      playerAssists:[]
    },

    {
      id:"t4",
      name:"4to Torneo - Apertura",
      type:"league_playoff",
      status:"historical",
      createdAt:"17 Jun 2023 / 24 Jun 2023",
      config:{legs:1},
      teamIds:["pantera","trucha","guanaco","perla","polpetta","parrilla"],
      matches:[
        {id:"t4j1a",stage:"regular",round:"Jornada 1",label:"Partido 1",home:"pantera",away:"trucha",homeGoals:3,awayGoals:4,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j1b",stage:"regular",round:"Jornada 1",label:"Partido 2",home:"guanaco",away:"perla",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j1c",stage:"regular",round:"Jornada 1",label:"Partido 3",home:"polpetta",away:"parrilla",homeGoals:3,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j2a",stage:"regular",round:"Jornada 2",label:"Partido 1",home:"trucha",away:"perla",homeGoals:3,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j2b",stage:"regular",round:"Jornada 2",label:"Partido 2",home:"parrilla",away:"guanaco",homeGoals:4,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j2c",stage:"regular",round:"Jornada 2",label:"Partido 3",home:"pantera",away:"polpetta",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j3a",stage:"regular",round:"Jornada 3",label:"Partido 1",home:"polpetta",away:"trucha",homeGoals:3,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j3b",stage:"regular",round:"Jornada 3",label:"Partido 2",home:"guanaco",away:"pantera",homeGoals:2,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j3c",stage:"regular",round:"Jornada 3",label:"Partido 3",home:"perla",away:"parrilla",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j4a",stage:"regular",round:"Jornada 4",label:"Partido 1",home:"polpetta",away:"guanaco",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j4b",stage:"regular",round:"Jornada 4",label:"Partido 2",home:"trucha",away:"parrilla",homeGoals:4,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j4c",stage:"regular",round:"Jornada 4",label:"Partido 3",home:"pantera",away:"perla",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j5a",stage:"regular",round:"Jornada 5",label:"Partido 1",home:"guanaco",away:"trucha",homeGoals:0,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j5b",stage:"regular",round:"Jornada 5",label:"Partido 2",home:"perla",away:"polpetta",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4j5c",stage:"regular",round:"Jornada 5",label:"Partido 3",home:"parrilla",away:"pantera",homeGoals:2,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4s1",stage:"knockout",round:"Semifinales",label:"Semifinal 1",home:"polpetta",away:"parrilla",homeGoals:4,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4s2",stage:"knockout",round:"Semifinales",label:"Semifinal 2",home:"perla",away:"trucha",homeGoals:1,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4t",stage:"knockout",round:"3er Lugar",label:"3° y 4°",home:"parrilla",away:"perla",homeGoals:1,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t4f",stage:"knockout",round:"Final",label:"Final",home:"polpetta",away:"trucha",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"polpetta",
      runnerUp:"trucha",
      third:"parrilla",
      notes:["El playoff histórico fue cargado exactamente como aparece en el registro."],
      playerScorers:[],
      playerAssists:[]
    },

    {
      id:"t5",
      name:"5to Torneo - Clausura",
      type:"league_playoff",
      status:"historical",
      createdAt:"24 Jun 2023 / 20 Ago 2023",
      config:{legs:1},
      teamIds:["trucha","pantera","perla","guanaco","parrilla","polpetta"],
      matches:[
        {id:"t5j1a",stage:"regular",round:"Jornada 1",label:"Partido 1",home:"trucha",away:"pantera",homeGoals:0,awayGoals:0,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j1b",stage:"regular",round:"Jornada 1",label:"Partido 2",home:"perla",away:"guanaco",homeGoals:0,awayGoals:4,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j1c",stage:"regular",round:"Jornada 1",label:"Partido 3",home:"parrilla",away:"polpetta",homeGoals:1,awayGoals:4,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j2a",stage:"regular",round:"Jornada 2",label:"Partido 1",home:"perla",away:"trucha",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j2b",stage:"regular",round:"Jornada 2",label:"Partido 2",home:"guanaco",away:"parrilla",homeGoals:2,awayGoals:3,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j2c",stage:"regular",round:"Jornada 2",label:"Partido 3",home:"polpetta",away:"pantera",homeGoals:4,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j3a",stage:"regular",round:"Jornada 3",label:"Partido 1",home:"trucha",away:"polpetta",homeGoals:2,awayGoals:4,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j3b",stage:"regular",round:"Jornada 3",label:"Partido 2",home:"pantera",away:"guanaco",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j3c",stage:"regular",round:"Jornada 3",label:"Partido 3",home:"parrilla",away:"perla",homeGoals:6,awayGoals:1,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j4a",stage:"regular",round:"Jornada 4",label:"Partido 1",home:"parrilla",away:"trucha",homeGoals:3,awayGoals:0,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j4b",stage:"regular",round:"Jornada 4",label:"Partido 2",home:"guanaco",away:"polpetta",homeGoals:2,awayGoals:3,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j4c",stage:"regular",round:"Jornada 4",label:"Partido 3",home:"perla",away:"pantera",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j5a",stage:"regular",round:"Jornada 5",label:"Partido 1",home:"trucha",away:"guanaco",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j5b",stage:"regular",round:"Jornada 5",label:"Partido 2",home:"polpetta",away:"perla",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5j5c",stage:"regular",round:"Jornada 5",label:"Partido 3",home:"pantera",away:"parrilla",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5s1",stage:"knockout",round:"Semifinales",label:"Semifinal 1",home:"polpetta",away:"perla",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,venue:"Wladi's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5s2",stage:"knockout",round:"Semifinales",label:"Semifinal 2",home:"pantera",away:"parrilla",homeGoals:0,awayGoals:4,homePens:null,awayPens:null,venue:"Wladi's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5t",stage:"knockout",round:"3er Lugar",label:"3° y 4°",home:"perla",away:"pantera",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t5f",stage:"knockout",round:"Final",label:"Final",home:"polpetta",away:"parrilla",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,venue:"Wladi's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"polpetta",
      runnerUp:"parrilla",
      third:"pantera",
      playerScorers:[
        ["Giulio Locatelli","polpetta",7,18],
        ["Luis Felipe","parrilla",6,17],
        ["Sid Koslowski","guanaco",5,7],
        ["Cindy Fitzgerald","pantera",7,5],
        ["El Kraken","perla",6,5]
      ],
      playerAssists:[
        ["Vito Volta","polpetta",5,6],
        ["Joe Pavo","parrilla",3,5],
        ["Rod Lete","parrilla",4,3],
        ["Randolph Salazar","perla",5,2],
        ["Donald Ortega","trucha",4,2]
      ]
    },

    {
      id:"t6",
      name:"6to Torneo - Copa SuPizza",
      type:"direct_knockout",
      status:"historical",
      createdAt:"07 Abr 2024 / 12 May 2024",
      config:{legs:1},
      teamIds:["trucha","perla","parrilla","polpetta","guanaco","pantera"],
      matches:[
        {id:"t6q1",stage:"knockout",round:"Cuartos",label:"Cuartos 1",home:"trucha",away:"perla",homeGoals:3,awayGoals:3,homePens:2,awayPens:3,venue:"Carloco's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t6q2",stage:"knockout",round:"Cuartos",label:"Cuartos 2",home:"parrilla",away:"polpetta",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,venue:"Carloco's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t6s1",stage:"knockout",round:"Semifinales",label:"Semifinal 1",home:"perla",away:"guanaco",homeGoals:2,awayGoals:1,homePens:null,awayPens:null,venue:"Carloco's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t6s2",stage:"knockout",round:"Semifinales",label:"Semifinal 2",home:"pantera",away:"polpetta",homeGoals:1,awayGoals:3,homePens:null,awayPens:null,venue:"Carloco's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t6f",stage:"knockout",round:"Final",label:"Final",home:"polpetta",away:"perla",homeGoals:2,awayGoals:3,homePens:null,awayPens:null,venue:"Carloco's House - Campo 1",date:"",time:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"perla",
      runnerUp:"polpetta",
      third:null,
      notes:["Sporting La Trucha 3-3 La Perla United se definió en penales: La Perla ganó 3-2."],
      playerScorers:[
        ["Giulio Locatelli","polpetta",3,6],
        ["El Kraken","perla",2,3],
        ["Boris Lentz","trucha",2,3],
        ["Omar Watson","perla",1,2]
      ],
      playerAssists:[
        ["Rosendo Acosta","guanaco",3,2],
        ["Eusebio Flowers","perla",1,2],
        ["Kelly Rivera","trucha",2,1],
        ["Angelo Carboni","trucha",2,1]
      ]
    },

    {
      id:"t7",
      name:"7mo Torneo - Apertura CoPascua",
      type:"league_playoff",
      status:"historical",
      createdAt:"18 Abr 2025 / 2025",
      config:{legs:1},
      teamIds:["pantera","polpetta","perla","parrilla","trucha","guanaco"],
      manualStandings:[
        {teamId:"perla", pj:5, pg:4, pe:0, pp:1, gf:13, gc:8, dg:5, pts:12, pos:1},
        {teamId:"pantera", pj:5, pg:2, pe:2, pp:1, gf:10, gc:9, dg:1, pts:8, pos:2},
        {teamId:"trucha", pj:5, pg:2, pe:0, pp:3, gf:9, gc:8, dg:1, pts:6, pos:3},
        {teamId:"parrilla", pj:5, pg:1, pe:2, pp:2, gf:12, gc:15, dg:-3, pts:5, pos:4},
        {teamId:"polpetta", pj:5, pg:0, pe:4, pp:1, gf:5, gc:8, dg:-3, pts:4, pos:5},
        {teamId:"guanaco", pj:5, pg:0, pe:1, pp:4, gf:4, gc:15, dg:-11, pts:1, pos:6}
      ],
      matches:[
        {id:"t7j1a",stage:"regular",round:"Fecha 1",label:"Partido 1",home:"pantera",away:"polpetta",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j1b",stage:"regular",round:"Fecha 1",label:"Partido 2",home:"perla",away:"parrilla",homeGoals:4,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j1c",stage:"regular",round:"Fecha 1",label:"Partido 3",home:"trucha",away:"guanaco",homeGoals:3,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j2a",stage:"regular",round:"Fecha 2",label:"Partido 1",home:"parrilla",away:"guanaco",homeGoals:6,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j2b",stage:"regular",round:"Fecha 2",label:"Partido 2",home:"polpetta",away:"trucha",homeGoals:0,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j2c",stage:"regular",round:"Fecha 2",label:"Partido 3",home:"perla",away:"pantera",homeGoals:5,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j3a",stage:"regular",round:"Fecha 3",label:"Partido 1",home:"pantera",away:"parrilla",homeGoals:3,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j3b",stage:"regular",round:"Fecha 3",label:"Partido 2",home:"trucha",away:"perla",homeGoals:1,awayGoals:4,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j3c",stage:"regular",round:"Fecha 3",label:"Partido 3",home:"guanaco",away:"polpetta",homeGoals:1,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j4a",stage:"regular",round:"Fecha 4",label:"Partido 1",home:"pantera",away:"trucha",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j4b",stage:"regular",round:"Fecha 4",label:"Partido 2",home:"perla",away:"guanaco",homeGoals:0,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j4c",stage:"regular",round:"Fecha 4",label:"Partido 3",home:"parrilla",away:"polpetta",homeGoals:0,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j5a",stage:"regular",round:"Fecha 5",label:"Partido 1",home:"guanaco",away:"pantera",homeGoals:0,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j5b",stage:"regular",round:"Fecha 5",label:"Partido 2",home:"polpetta",away:"perla",homeGoals:3,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7j5c",stage:"regular",round:"Fecha 5",label:"Partido 3",home:"trucha",away:"parrilla",homeGoals:2,awayGoals:0,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7s1",stage:"knockout",round:"Semifinales",label:"Semifinal 1",home:"perla",away:"parrilla",homeGoals:5,awayGoals:3,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7s2",stage:"knockout",round:"Semifinales",label:"Semifinal 2",home:"pantera",away:"trucha",homeGoals:5,awayGoals:1,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7t",stage:"knockout",round:"3er Lugar",label:"3° y 4°",home:"trucha",away:"parrilla",homeGoals:6,awayGoals:4,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""},
        {id:"t7f",stage:"knockout",round:"Final",label:"Final",home:"pantera",away:"perla",homeGoals:3,awayGoals:2,homePens:null,awayPens:null,date:"",time:"",venue:"",homeGoalLog:"",awayGoalLog:""}
      ],
      champion:"pantera",
      runnerUp:"perla",
      third:"trucha",
      playerScorers:[
        ["El Kraken","perla",8,11],
        ["Nancy King","pantera",7,8],
        ["Boris Lentz","trucha",7,7],
        ["Giulio Locatelli","polpetta",5,6],
        ["Luis Felipe","parrilla",7,6]
      ],
      playerAssists:[
        ["Randolph Salazar","perla",8,6],
        ["Lina Yamamoto","pantera",7,5],
        ["Kelly Rivera","trucha",7,4],
        ["Rod Lete","parrilla",7,4],
        ["Mario De Luca","polpetta",5,3]
      ]
    }
  ]
};
