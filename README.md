# CraftShop Bot

Bot Discord em Node.js com `discord.js`, sorteios automáticos e abertura de atendimentos privados.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação/bot criado no [Discord Developer Portal](https://discord.com/developers/applications)
- Permissão do bot para gerenciar comandos, enviar mensagens, incorporar links, gerenciar canais e fixar mensagens

## Rodar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `DISCORD_TOKEN` e `DISCORD_CLIENT_ID`. Nunca publique o `.env`.
3. Instale as dependências:

   ```bash
   npm ci
   ```

4. Inicie o bot:

   ```bash
   npm start
   ```

O bot registra `/sorteio` e `/suporte` globalmente. O comando `/sorteio` é restrito a membros com a permissão **Gerenciar servidor**.

### Sorteios

Use `/sorteio premio:... duracao:30m ganhadores:1`. A duração aceita `s` (segundos), `m` (minutos), `h` (horas) e `d` (dias), com limite de 31 dias. Os participantes entram e saem pelo botão, e o resultado é anunciado automaticamente no canal configurado.

### Suporte

Use `/suporte` em um servidor para publicar o painel no canal configurado. Cada membro pode abrir um canal privado de atendimento. A regra adicional do suporte ainda pode ser personalizada conforme a necessidade da comunidade.

## GitHub

Crie um repositório privado ou público, copie os arquivos e faça o primeiro envio sem incluir `.env`:

```bash
git init
git add .
git commit -m "feat: add CraftShop Discord bot"
git branch -M main
git remote add origin https://github.com/ttooeasycraft-ui/CraftShopbot.git
git push -u origin main
```

Se for usar automação, configure `GITHUB_TOKEN` como secret do ambiente. Não coloque o token na URL, em commits, no README ou no código.

## Railway

1. Crie um novo projeto no Railway a partir do repositório do GitHub.
2. O Railway detectará o `Dockerfile` e usará Node 20 Alpine.
3. Em **Variables**, adicione `DISCORD_TOKEN` e `DISCORD_CLIENT_ID`.
4. Faça o deploy. O `railway.toml` configura o Dockerfile e reinício automático em caso de falha.

O `GITHUB_TOKEN` não é necessário para o bot funcionar em produção; ele só deve existir se você optar por alguma automação de GitHub.