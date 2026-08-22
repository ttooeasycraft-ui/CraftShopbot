# CraftShop Bot

Bot Discord em Node.js com `discord.js`, sorteios automáticos e abertura de atendimentos privados.

## Requisitos

- Node.js 20 ou superior
- Uma aplicação/bot criado no [Discord Developer Portal](https://discord.com/developers/applications)
- Permissão do bot para gerenciar comandos, enviar mensagens, incorporar links, gerenciar canais e fixar mensagens
- Para tickets, o bot também precisa de **Gerenciar canais** e a staff deve ter **Gerenciar servidor**

## Rodar localmente

1. Copie `.env.example` para `.env`.
2. Preencha `DISCORD_TOKEN` e `ID_CLIENTE`. Nunca publique o `.env`.
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

Use `/suporte` em um servidor para publicar ou reparar o painel no canal configurado. O painel possui apenas um menu de seleção com as categorias Parcerias, Suporte e Reserva/Compra; não há botão separado para abrir tickets.

> Precisando de ajuda? Crie um ticket aqui e nossa equipe vai te atender o mais rápido possível.

Cada membro pode abrir um canal privado dentro da categoria de tickets configurada no código. Dentro dele existem os botões **Fechar Ticket** e **Reivindicar Ticket**. O botão de reivindicação é restrito à staff; o ticket pode ser fechado pelo autor ou pela staff. Os cargos configurados de staff e o bot recebem acesso ao canal.

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
3. Em **Variables**, adicione ou substitua:
   - `DISCORD_TOKEN` — token atual do bot, após regenerá-lo no Discord Developer Portal
   - `ID_CLIENTE` — Application ID atual do bot
   - `GITHUB_TOKEN` — somente se alguma automação de GitHub for usada; o bot não precisa desta variável para funcionar
4. Faça o deploy. O `railway.toml` configura o Dockerfile e reinício automático em caso de falha.

O Dockerfile copia `package.json` e `package-lock.json`, executa `npm ci --omit=dev` e só depois inicia `node index.js`. Se o Railway mostrar `Cannot find module 'dotenv'`, confirme que o serviço está usando o branch `main` e faça um novo deploy sem cache.