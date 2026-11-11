# Especificação - Document Management System

**Status:** MVP proposto  
**Escopo desta entrega:** somente esta especificação; nenhum arquivo de backend ou frontend faz parte da execução atual.

## 1. Objetivo

Oferecer uma aplicação web simples para enviar, listar e baixar documentos armazenados no filesystem local, mantendo seus metadados em memória.

## 2. Escopo

### Dentro do escopo

- Enviar um arquivo por solicitação.
- Armazenar o conteúdo em `backend/storage`, usando Multer com `diskStorage`.
- Registrar em memória o identificador, nome original, tamanho, data de envio e dono do documento.
- Listar os documentos disponíveis e baixar um documento por identificador.
- Apresentar na interface os fluxos de envio, listagem, download e erros de operação.
- Executar sem autenticação: no MVP, todos os clientes acessam a mesma coleção de documentos.

### Fora do escopo

- Autenticação, autorização ou isolamento real de documentos por usuário.
- Cadastro e gestão de contas de usuário.
- Armazenamento em nuvem, banco de dados ou provedores externos.
- Persistência durável dos metadados, recuperação automática após reinício, backup ou replicação.
- Edição, exclusão, versionamento, busca, paginação ou compartilhamento de documentos.
- Allowlist de extensões ou tipos MIME. Tipos de arquivo não são restringidos pelo MVP.

### Premissas e limites

- `owner` é um identificador operacional fixo para a instância, não uma identidade autenticada. Seu valor vem da configuração `DMS_DEFAULT_OWNER`, com padrão `local-user`.
- A aplicação inteira compartilha a mesma coleção; a listagem não filtra por `owner`.
- O limite padrão de upload é 10 MiB por arquivo e pode ser alterado por `DMS_MAX_FILE_SIZE_BYTES`.
- O limite padrão para armazenamento local é 1 GiB e o limite de documentos por processo é 1000; ambos podem ser configurados por `DMS_MAX_STORAGE_BYTES` e `DMS_MAX_DOCUMENTS`.
- O backend aceita até 8 uploads simultâneos por processo, configurável por `DMS_MAX_CONCURRENT_UPLOADS`; novas solicitações concorrentes recebem `429`.
- O backend escuta em `127.0.0.1` por padrão. Para acesso remoto, `DMS_HOST` pode ser configurado explicitamente, mas a API do MVP não tem autenticação e deve ser protegida por uma rede confiável ou camada externa de controle de acesso.
- Arquivos podem continuar no disco após o encerramento do processo, mas os metadados em memória são perdidos. Reiniciar o processo não recupera esses metadados.
- A quota contabiliza arquivos regulares já existentes no diretório na inicialização do repositório, inclusive arquivos órfãos de reinicializações; symlinks não são seguidos nem contabilizados como documentos.
- As respostas e mensagens descritas abaixo são o contrato esperado, não funcionalidades já presentes no seed atual.

## 3. Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF-01 | O sistema deve aceitar o envio de um único arquivo por requisição multipart, no campo `file`. | Um envio válido grava o arquivo localmente e responde `201` com os metadados do documento. |
| RF-02 | O sistema deve rejeitar envio sem arquivo, com arquivo vazio, multipart inválido ou acima do limite configurado. | Entrada ausente, vazia ou malformada responde `400`; arquivo acima do limite responde `413`; nenhum registro de documento incompleto é listado. |
| RF-03 | O sistema deve atribuir um identificador único e um nome interno de armazenamento que não dependa do nome fornecido pelo cliente. | Dois envios com o mesmo nome original não sobrescrevem um ao outro; caminhos internos não aparecem nas respostas. |
| RF-04 | O sistema deve registrar `originalName`, tamanho em bytes, data/hora do envio e `owner`. | O objeto retornado no envio e na listagem inclui os campos públicos definidos na seção 5. |
| RF-05 | O sistema deve listar todos os documentos registrados na instância. | A resposta inclui `documents`, ordenados por `uploadedAt` decrescente; coleção vazia retorna uma lista vazia. |
| RF-06 | O sistema deve permitir baixar um documento usando seu `id`. | Um ID existente retorna os bytes como anexo; ID desconhecido ou arquivo indisponível responde `404`. |
| RF-07 | O sistema deve comunicar falhas de forma consistente sem expor caminhos locais ou detalhes internos. | Erros da API seguem o formato definido na seção 6; falhas inesperadas retornam `500`. |
| RF-08 | A interface deve permitir selecionar e enviar um arquivo, apresentar a lista e iniciar o download de um documento. | A interface apresenta o estado de carregamento, o resultado da operação e uma mensagem de erro recuperável quando a chamada falha. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | O conteúdo dos arquivos deve ser gravado exclusivamente no filesystem local da aplicação, em `backend/storage`, usando Multer com `diskStorage`. Não usar armazenamento externo. |
| RNF-02 | Metadados devem permanecer em memória durante a vida do processo. O MVP não promete durabilidade nem recuperação após reinício. |
| RNF-03 | O backend deve manter a separação `routes -> controllers -> services -> repositories`, sem fazer camadas internas dependerem do Express ou de detalhes HTTP. |
| RNF-04 | Configurações de porta, bind, limites de arquivo/armazenamento/documentos/concorrência e identificador padrão de dono devem vir de variáveis de ambiente, com defaults documentados. |
| RNF-05 | O nome de arquivo interno deve ser gerado pela aplicação. O nome original não pode ser concatenado a um caminho de filesystem. |
| RNF-06 | A API deve usar respostas JSON em UTF-8 para metadados e erros; o download deve transferir o conteúdo binário como anexo. |
| RNF-07 | O frontend deve chamar a API com `fetch` pelo prefixo `/api`; em desenvolvimento, o proxy Vite encaminha para o backend e remove esse prefixo. |
| RNF-08 | A implementação futura deve seguir o stack existente: Node.js, Express, CommonJS, React, Vite e testes backend com `node:test`, preferindo dependências já instaladas. |

### Configuração proposta

| Variável | Default | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `DMS_HOST` | `127.0.0.1` | Interface de rede do backend. Um bind externo exige proteção de rede porque o MVP não tem autenticação. |
| `DMS_MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo de um arquivo, em bytes (10 MiB). Deve ser um inteiro positivo. |
| `DMS_MAX_STORAGE_BYTES` | `1073741824` | Quota local para arquivos contabilizados, em bytes (1 GiB). Deve ser maior ou igual ao limite por arquivo. |
| `DMS_MAX_DOCUMENTS` | `1000` | Número máximo de documentos com metadados no processo. Deve ser um inteiro positivo. |
| `DMS_MAX_CONCURRENT_UPLOADS` | `8` | Número máximo de uploads em processamento simultaneamente. Deve ser um inteiro positivo. |
| `DMS_DEFAULT_OWNER` | `local-user` | Valor atribuído ao campo `owner` nos uploads. Não é credencial nem mecanismo de autorização. |

Configuração ausente usa o default. Valor inválido para o limite deve impedir a inicialização ou ser reportado claramente, sem substituir silenciosamente o limite por um valor sem limite.

## 5. Modelo de dados

### Metadados públicos do documento

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `id` | string | Sim | Identificador único, recomendado UUID. Usado nas rotas de listagem e download. |
| `originalName` | string | Sim | Nome original fornecido pelo cliente, preservado como metadado e tratado com segurança ao exibir ou compor o header de download. |
| `size` | number | Sim | Tamanho efetivamente gravado, em bytes; inteiro não negativo. Arquivos de tamanho zero são rejeitados. |
| `uploadedAt` | string | Sim | Instante do recebimento bem-sucedido, serializado em ISO 8601 UTC, por exemplo `2026-11-11T12:30:00.000Z`. |
| `owner` | string | Sim | Valor configurado em `DMS_DEFAULT_OWNER`. É apenas metadado e não representa usuário autenticado. |

Exemplo de representação pública:

```json
{
  "id": "4e8d6704-7075-44fd-9b48-04bd7e0380ee",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-11-11T12:30:00.000Z",
  "owner": "local-user"
}
```

### Dados internos de persistência

O repositório mantém, em memória, os metadados públicos associados a uma chave de armazenamento interna gerada pela aplicação. A chave deve ser opaca (por exemplo, UUID sem o nome original) e identificar o arquivo dentro de `backend/storage`. O tipo MIME recebido pode ser mantido internamente para o header de resposta; ele não é validado como lista de tipos permitidos.

A chave interna, o caminho absoluto, os detalhes de Multer e qualquer caminho do filesystem não fazem parte do modelo público nem de respostas JSON. A estrutura exata em memória é uma decisão de implementação, desde que preserve esse contrato.

## 6. Contratos de API

As rotas do backend não têm prefixo `/api`. O frontend usa `/api` no endereço chamado pelo navegador; o proxy de desenvolvimento configurado no Vite remove esse prefixo antes de encaminhar a requisição. Exemplos: chamada do frontend `/api/documents` corresponde à rota backend `/documents`.

### Formato de erro

Todas as respostas de erro da API devem usar JSON no formato:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

`code` é estável para consumo pelo frontend; `message` é uma mensagem segura e compreensível em português. Não incluir stack trace, caminho local ou detalhes internos.

### `POST /upload`

- **Content-Type:** `multipart/form-data`.
- **Campo obrigatório:** `file`, contendo um arquivo por requisição.
- **Limite:** `DMS_MAX_FILE_SIZE_BYTES`, padrão 10 MiB.
- A requisição aceita somente a parte `file`; campos multipart adicionais são rejeitados.
- **Sucesso:** `201 Created`, corpo JSON com o objeto público do documento.
- **Erros:** `400 Bad Request` para campo ausente, arquivo vazio ou multipart inválido; `413 Payload Too Large` para arquivo acima do limite; `500 Internal Server Error` para falha inesperada de escrita ou persistência.
- **Quota:** `507 Insufficient Storage` quando a quota local ou o limite de documentos foi atingido.
- **Concorrência:** `429 Too Many Requests` quando o limite de uploads em processamento foi atingido.
- O cliente não deve definir manualmente o header `Content-Type` ao usar `FormData`; o navegador precisa incluir o boundary multipart.

Exemplo de sucesso:

```json
{
  "id": "4e8d6704-7075-44fd-9b48-04bd7e0380ee",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-11-11T12:30:00.000Z",
  "owner": "local-user"
}
```

### `GET /documents`

- **Sucesso:** `200 OK`, corpo JSON com envelope `documents`.
- Os documentos são ordenados por `uploadedAt` decrescente. Em empate, a implementação deve usar ordenação determinística por `id`.
- Coleção sem documentos retorna `200` e `documents: []`.
- Não há parâmetros de paginação, busca ou filtro por usuário no MVP.

Exemplo:

```json
{
  "documents": [
    {
      "id": "4e8d6704-7075-44fd-9b48-04bd7e0380ee",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-11-11T12:30:00.000Z",
      "owner": "local-user"
    }
  ]
}
```

### `GET /documents/:id/download`

- **Sucesso:** `200 OK`, corpo binário do arquivo.
- A resposta deve incluir `Content-Disposition: attachment` com o nome original tratado com segurança e `Content-Type` do arquivo quando disponível; usar `application/octet-stream` como fallback.
- ID desconhecido ou arquivo local indisponível retorna `404 Not Found` usando o formato de erro comum.
- Falha inesperada de leitura retorna `500 Internal Server Error`, sem expor o caminho local.
- Se o repositório detectar que o arquivo não existe mais, deve remover o metadado obsoleto da coleção em memória antes de responder `404`.

### Códigos de erro

| HTTP | `code` | Situação |
| --- | --- | --- |
| `400` | `FILE_REQUIRED` | Campo `file` ausente. |
| `400` | `EMPTY_FILE` | Arquivo enviado sem conteúdo. |
| `400` | `INVALID_MULTIPART` | Requisição multipart inválida ou malformada. |
| `404` | `DOCUMENT_NOT_FOUND` | ID inexistente ou arquivo correspondente indisponível. |
| `413` | `FILE_TOO_LARGE` | Arquivo excede o limite configurado. |
| `429` | `TOO_MANY_UPLOADS` | Número máximo de uploads simultâneos atingido. |
| `507` | `STORAGE_QUOTA_EXCEEDED` | Quota de bytes ou quantidade máxima de documentos atingida. |
| `500` | `STORAGE_ERROR` | Falha inesperada ao gravar ou ler o arquivo. |
| `500` | `INTERNAL_ERROR` | Outra falha inesperada. |

Falhas de escrita não podem resultar em um documento parcialmente cadastrado. Se o arquivo for gravado, mas o registro dos metadados falhar, a implementação deve tentar remover o arquivo recém-gravado e retornar erro. A resposta não deve indicar caminhos do filesystem.

## 7. Decisões arquiteturais

### Backend

- **Routes:** declaram os caminhos e métodos HTTP, aplicam o middleware de upload e delegam ao controller.
- **Controllers:** adaptam request/response HTTP, validam a forma básica da entrada e selecionam status e representação de resposta.
- **Services:** coordenam os casos de uso (enviar, listar e baixar), aplicam regras de negócio e mantêm o fluxo consistente em caso de falha.
- **Repositories:** encapsulam o catálogo de metadados em memória e o acesso aos arquivos locais, sem expor detalhes de persistência às camadas externas.
- O fluxo de dependência é `routes -> controllers -> services -> repositories`. Camadas internas não dependem de Express.
- Multer com `diskStorage` grava exclusivamente em `backend/storage`. O nome de armazenamento é gerado, nunca derivado como caminho do nome recebido do cliente.

### Frontend

- Aplicação React com componentes funcionais e Hooks, organizada nas áreas já previstas de páginas, componentes e serviços.
- O serviço de API usa `fetch` com `/api/upload`, `/api/documents` e `/api/documents/:id/download`; o proxy Vite remove `/api` e encaminha para `http://localhost:3000` em desenvolvimento.
- A interface diferencia carregamento, sucesso, lista vazia e erro. Erros HTTP devem ser lidos do formato JSON da API; o download deve tratar a resposta como binária.

### Armazenamento e identidade

- Os arquivos são locais e não devem ser enviados a terceiros.
- Metadados são voláteis e compartilhados por todos os clientes da instância. A perda do catálogo após reinício é uma limitação aceita do MVP.
- Não existe autenticação nem autorização. O campo `owner` não pode ser usado para afirmar que documentos estão protegidos ou isolados.

## 8. Plano de execução

As fases abaixo são um roadmap conceitual para implementação futura. **Nesta entrega, a execução limita-se a criar este documento; não se implementam nem alteram arquivos de backend ou frontend.**

1. **Formalizar os contratos:** transformar requisitos, configuração, validações e respostas desta especificação em critérios de implementação e teste.
2. **Implementar o fluxo de documentos no backend:** receber uploads com Multer `diskStorage`, validar entradas e limites, registrar metadados em memória e oferecer listagem e download pelas camadas definidas.
3. **Implementar os fluxos da interface:** permitir upload, apresentar a lista, iniciar download e exibir estados vazios, carregamento e erros.
4. **Integrar e validar o MVP:** verificar os contratos de API, os limites e erros de upload, a ordenação, o download, a configuração do proxy e a limitação de metadados voláteis; executar testes automatizados e uma verificação manual da interface.

### Critérios de aceite do MVP

- Um upload válido grava um arquivo em armazenamento local e retorna metadados públicos completos.
- Entradas ausentes, vazias, malformadas ou maiores que o limite recebem o status e o formato de erro especificados, sem deixar registro incompleto.
- A listagem inclui os documentos em ordem definida e não expõe dados internos de armazenamento.
- Um documento existente pode ser baixado como anexo; um documento desconhecido ou indisponível resulta em `404`.
- A interface consegue enviar, listar e baixar usando o prefixo `/api` em desenvolvimento e comunica falhas de forma compreensível.
- Não há dependência de armazenamento externo, banco de dados, autenticação ou persistência de metadados além do escopo do MVP.