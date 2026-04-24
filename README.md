# Contract Insight API

API em Node.js com Express para analisar contratos em texto, identificar riscos, clausulas criticas, campos ausentes e gerar um resumo executivo para apoio a decisao.

## Objetivo

A Contract Insight API ajuda empresas a fazer uma leitura inicial de contratos de forma automatizada, usando regras simples, palavras-chave e padroes textuais. Toda a analise acontece em memoria, sem banco de dados e sem uso de inteligencia artificial externa.

## Tecnologias usadas

- Node.js
- Express
- JavaScript
- CORS
- dotenv
- Nodemon
- JSON
- HTML e CSS para a pagina inicial da API

## Estrutura do projeto

```text
contract-insight-api/
├── src/
│   ├── app.js
│   ├── server.js
│   ├── routes/
│   │   └── contract.routes.js
│   ├── controllers/
│   │   └── contract.controller.js
│   ├── public/
│   │   ├── index.html
│   │   └── styles.css
│   ├── services/
│   │   └── contract.service.js
│   ├── utils/
│   │   ├── validators.js
│   │   └── keywords.js
│   └── data/
│       └── sample-contract.json
├── .env.example
├── package.json
└── README.md
```

## Como instalar

```bash
npm install
```

## Como rodar

1. Copie o arquivo `.env.example` para `.env` se quiser definir uma porta customizada.
2. Use a porta padrao 3000 ou configure a variavel `PORT`.
3. Execute o projeto em modo desenvolvimento:

```bash
npm run dev
```

Para rodar sem nodemon:

```bash
npm start
```

## Como testar no Insomnia ou Postman

Base URL local:

```text
http://localhost:3000
```

Ao abrir a raiz da aplicacao no navegador, a API tambem exibe uma pagina inicial simples com resumo visual dos endpoints.

### GET /health

Verifica se a API esta no ar.

Resposta esperada:

```json
{
  "status": "ok",
  "message": "Contract Insight API is running"
}
```

### POST /contracts/analyze

Analisa um contrato em texto.

#### Exemplo de requisicao

```http
POST /contracts/analyze
Content-Type: application/json
```

```json
{
  "contractText": "CONTRATO DE PRESTACAO DE SERVICOS. Pelo presente instrumento, de um lado, Empresa Alpha Tecnologia LTDA, inscrita no CNPJ 12.345.678/0001-90, neste ato representada por seu diretor, doravante denominada CONTRATANTE, e, de outro lado, Consultoria Beta Digital LTDA, inscrita no CNPJ 98.765.432/0001-10, doravante denominada CONTRATADA, firmam o presente contrato. O objeto deste contrato e a prestacao de servicos de implantacao de processos comerciais. O pagamento sera realizado em 3 parcelas mensais por PIX, apos emissao de nota fiscal. Em caso de atraso superior a 10 dias, podera haver penalidade. O contrato podera ser rescindido mediante aviso previo de 30 dias. Fica eleito o foro da comarca de Sao Paulo para dirimir conflitos. Local: Sao Paulo, data: 10 de janeiro de 2026.",
  "contractType": "prestacao_servico"
}
```

#### Exemplo de resposta

```json
{
  "summary": {
    "contractType": "prestacao_servico",
    "riskScore": 68,
    "riskLevel": "alto",
    "executiveSummary": "O contrato do tipo prestacao_servico apresenta risco alto, principalmente pela ausencia de valor do contrato e prazo do contrato. Recomenda-se revisao antes da assinatura."
  },
  "missingFields": [
    "valor do contrato",
    "prazo do contrato",
    "testemunhas"
  ],
  "criticalClauses": [
    {
      "type": "rescisao",
      "severity": "alta",
      "found": true,
      "description": "Foi identificada clausula de rescisao do contrato."
    },
    {
      "type": "foro",
      "severity": "media",
      "found": true,
      "description": "Foi identificada definicao de foro competente."
    },
    {
      "type": "atraso",
      "severity": "media",
      "found": true,
      "description": "Foi identificada clausula relacionada a atraso."
    },
    {
      "type": "penalidade",
      "severity": "alta",
      "found": true,
      "description": "Foi identificada clausula de penalidade."
    }
  ],
  "risks": [
    {
      "risk": "Contrato sem valor definido",
      "severity": "alta",
      "recommendation": "Informar valor total, indice de reajuste e moeda aplicavel."
    },
    {
      "risk": "Contrato sem prazo definido",
      "severity": "alta",
      "recommendation": "Definir data de inicio, fim ou periodo de vigencia."
    },
    {
      "risk": "Contrato sem testemunhas",
      "severity": "baixa",
      "recommendation": "Avaliar a inclusao de testemunhas para reforcar a formalizacao."
    }
  ],
  "recommendations": [
    "Adicionar prazo de vigencia.",
    "Confirmar valor e forma de pagamento."
  ]
}
```

## Validacoes da entrada

Regras aplicadas no corpo da requisicao:

- `contractText` e obrigatorio
- `contractText` deve ser string
- `contractText` deve ter pelo menos 200 caracteres
- `contractType`, se informado, deve ser string

Em caso de erro, a API retorna JSON padronizado:

```json
{
  "error": true,
  "message": "Mensagem do erro"
}
```

## Regras de analise

A API procura pelos seguintes campos essenciais:

- partes envolvidas
- objeto do contrato
- valor do contrato
- prazo ou vigencia
- forma de pagamento
- multa
- rescisao
- foro
- assinatura das partes
- testemunhas
- data e local

A API tambem busca clausulas criticas por palavras-chave:

- multa
- rescisao
- indenizacao
- confidencialidade
- exclusividade
- foro
- atraso
- penalidade
- inadimplencia
- responsabilidade
- renovacao automatica
- prazo indeterminado

## Explicacao do riskScore

A pontuacao vai de 0 a 100 e segue estas regras:

- Campo essencial ausente: +8 pontos
- Clausula critica encontrada: +6 pontos
- Presenca de `prazo indeterminado`: +12 pontos
- Presenca de `renovacao automatica`: +10 pontos
- Ausencia de assinatura: +15 pontos
- Ausencia de valor: +10 pontos
- Ausencia de prazo: +10 pontos
- O valor final e limitado a 100

Faixas de risco:

- 0 a 30: baixo
- 31 a 60: medio
- 61 a 80: alto
- 81 a 100: critico

## Arquivo de exemplo

O arquivo [src/data/sample-contract.json](src/data/sample-contract.json) contem um contrato ficticio para testes locais.

## Possiveis melhorias futuras

- Upload de PDF
- Integracao com IA
- Historico de analises
- Login de empresas
- Dashboard administrativo

## O que falta para uso real com empresas

Hoje a API esta pronta para prototipo e validacao funcional. Para uso real em ambiente corporativo, o minimo recomendado e:

- Autenticacao e autorizacao por empresa, usuario e perfil de acesso
- Persistencia em banco de dados para guardar contratos, analises, auditoria e historico
- Upload real de arquivos PDF, DOCX e OCR para documentos escaneados
- Logs estruturados e monitoramento com alertas
- Rate limiting, protecao contra abuso e hardening de seguranca
- Validacoes juridicas mais robustas por tipo de contrato
- Versionamento de analises para comparar alteracoes entre revisoes
- Ambiente de homologacao e producao com variaveis de ambiente separadas
- Testes automatizados de unidade, integracao e carga
- Politica de privacidade, consentimento e adequacao a LGPD
- Criptografia de dados sensiveis em repouso e em transito
- Controle de retenção e descarte de documentos
- Painel administrativo para consulta, filtros e exportacao
- Filas e processamento assincrono para arquivos grandes
- Integração com assinatura eletronica e sistemas internos da empresa

Esses pontos transformam a API de demonstracao em um servico operacionalmente viavel para empresas.
