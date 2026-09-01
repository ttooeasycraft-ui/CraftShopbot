require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  ModalBuilder,
  PermissionFlagsBits,
  REST,
  Routes,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

const required = ["DISCORD_TOKEN", "ID_CLIENTE"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Variável obrigatória ausente: ${name}`);
}

const GIVEAWAY_CHANNEL_ID = "1363301153919729780";
const SUPPORT_CHANNEL_ID = "1363301154351616017";
const TICKET_CATEGORY_ID = "1363301154351616012";
const STAFF_ROLE_IDS = [
  "1363301153911078924",
  "1437575913897197618",
  "1363301153911078925",
  "1363301153911078926",
];
const DATA_FILE = path.join(__dirname, "data", "giveaways.json");
const BRAND = {
  green: 0x22c55e,
  orange: 0xf97316,
  blue: 0x38bdf8,
  purple: 0xa855f7,
};
const TICKET_COLORS = {
  parcerias: BRAND.green,
  suporte: BRAND.green,
  reserva: BRAND.green,
};
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});
const giveaways = new Map();

function readGiveaways() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) return;
  try {
    for (const item of JSON.parse(fs.readFileSync(DATA_FILE, "utf8"))) {
      if (item.status === "active") giveaways.set(item.id, item);
    }
  } catch (error) {
    console.error("Não foi possível ler os sorteios salvos:", error.message);
  }
}

function saveGiveaways() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify([...giveaways.values()], null, 2));
}

function parseDuration(value) {
  const match = String(value).trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const amount = Number(match[1]);
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const duration = amount * multipliers[match[2].toLowerCase()];
  return duration > 0 && duration <= 31 * 86_400_000 ? duration : null;
}

function giveawayEmbed(giveaway, ended = false) {
  return new EmbedBuilder()
    .setTitle("Sorteios")
    .setColor(ended ? 0x6b7280 : BRAND.green)
    .setDescription(
      ended
        ? `🎉 **Sorteio encerrado**\n\n⛏️ Prêmio: **${giveaway.prize}**\n💎 Ganhadores: ${giveaway.winners?.map((id) => `<@${id}>`).join(", ") || "Nenhum"}`
        : `🎉 **${giveaway.prize}**\n\n🧱 Clique em **Participar** para concorrer.\n💎 Ganhadores: **${giveaway.winnerCount}**\n⏳ Encerra em: <t:${Math.floor(giveaway.endsAt / 1000)}:R>`,
    )
    .setFooter({ text: "Craft Shop • Minecraft Graphics & Digital Goods" })
    .setTimestamp();
}

function giveawayButtons(id, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway_join:${id}`)
      .setLabel("Participar")
      .setEmoji("🎉")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
  );
}

async function finishGiveaway(giveaway) {
  const channel = await client.channels.fetch(giveaway.channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
  const participants = [...new Set(giveaway.participants || [])];
  const winners = participants
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(giveaway.winnerCount, participants.length));
  giveaway.status = "ended";
  giveaway.winners = winners;
  giveaways.delete(giveaway.id);
  saveGiveaways();
  if (message) await message.edit({ embeds: [giveawayEmbed(giveaway, true)], components: [giveawayButtons(giveaway.id, true)] });
  await channel.send(
    winners.length
      ? `🎉 Parabéns ${winners.map((id) => `<@${id}>`).join(", ")}! Você(s) ganhou(aram) **${giveaway.prize}**.`
      : `O sorteio de **${giveaway.prize}** terminou sem participantes.`,
  );
}

async function ensureInfoEmbed(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find((message) => message.author.id === client.user.id && ["Sorteios", "🎉 Sorteios"].includes(message.embeds[0]?.title));
  const embed = new EmbedBuilder()
    .setTitle("Sorteios")
    .setColor(BRAND.green)
    .setDescription("🎉 Sorteios ativos e encerrados serão postados aqui. Fique atento(a) para não perder prêmios incríveis! Participe e marque os amigos!")
    .addFields({ name: "⛏️ Craft Shop", value: "Prêmios, criatividade e muita diversão em um só lugar.", inline: false })
    .setFooter({ text: "Craft Shop • Minecraft Graphics & Digital Goods" });
  const message = existing
    ? await existing.edit({ embeds: [embed], components: [] })
    : await channel.send({ embeds: [embed] });
  console.log(`[painel:sorteios] ${existing ? `mensagem existente encontrada (${message.id})` : `mensagem enviada (${message.id})`}`);
}

function findCustomEmoji(guild, keywords) {
  return guild?.emojis.cache.find((emoji) => {
    const normalizedName = emoji.name?.toLowerCase() || "";
    return emoji.available && keywords.some((keyword) => normalizedName.includes(keyword));
  });
}

async function ensureSupportPanel(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const existingPanels = messages.filter((message) => message.author.id === client.user.id && ["Suporte", "Suporte CraftShop"].includes(message.embeds[0]?.title));
  const embed = new EmbedBuilder()
    .setTitle("Suporte")
    .setColor(BRAND.green)
    .setDescription(`Abra um ticket para seu pedido aqui!
Informe o serviço desejado, data de entrega e qualquer detalhe importante.
Clientes com reserva têm prioridade no atendimento.

Como faço a reserva?

Clique em 'abrir ticket'

Escolha o produto/serviço que deseja.

Envie uma mensagem no privado ou no ticket aberto 🔓 informando:
- Nome do produto/serviço
- Quantidade
- Qualquer detalhe ou personalização que queira

Aguarde a confirmação da sua reserva.

Pronto! Sua vaga está garantida. 🎉`)
    .addFields(
      { name: "🎮 Atendimento Craft Shop", value: "Nossa equipe está pronta para ajudar com seus pedidos e produtos digitais.", inline: false },
      { name: "🧱 Como funciona", value: "Clique abaixo, explique o que precisa e aguarde a nossa equipe.", inline: false },
    )
    .setFooter({ text: "Craft Shop • thumbnails, banners e artes personalizadas" });
  const partnershipEmoji = findCustomEmoji(channel.guild, ["parceria", "partner", "divulgacao", "megafone"]);
  const supportEmoji = findCustomEmoji(channel.guild, ["suporte", "support", "help", "adm", "dono"]);
  const purchaseEmoji = findCustomEmoji(channel.guild, ["reserva", "compra", "shop", "buy", "ticket"]);
  console.log(`[painel:suporte] emojis customizados: parcerias=${partnershipEmoji?.name || "não encontrado"}, suporte=${supportEmoji?.name || "não encontrado"}, reserva=${purchaseEmoji?.name || "não encontrado"}`);
  const menu = new StringSelectMenuBuilder()
    .setCustomId("support_category")
    .setPlaceholder("Selecione o tipo de atendimento")
    .addOptions(
      { label: "Parcerias", description: "Fale com dono/ADM sobre divulgação do seu servidor; envie o TXT do servidor", value: "parcerias", ...(partnershipEmoji && { emoji: { id: partnershipEmoji.id, name: partnershipEmoji.name } }) },
      { label: "Suporte", description: "Crie um ticket para falar com o ADM/DONO e receber ajuda", value: "suporte", ...(supportEmoji && { emoji: { id: supportEmoji.id, name: supportEmoji.name } }) },
      { label: "Reserva", description: "Crie um ticket para fazer sua reserva.", value: "reserva", ...(purchaseEmoji && { emoji: { id: purchaseEmoji.id, name: purchaseEmoji.name } }) },
    );
  const menuRow = new ActionRowBuilder().addComponents(menu);
  for (const oldPanel of existingPanels.values()) {
    await oldPanel.delete().catch((error) => console.error(`[painel:suporte] não foi possível apagar painel antigo (${oldPanel.id}):`, error.message));
    console.log(`[painel:suporte] painel antigo removido (${oldPanel.id})`);
  }
  const message = await channel.send({ embeds: [embed], components: [menuRow] });
  console.log(`[painel:suporte] painel verde enviado (${message.id})`);
}

async function ensurePanelInChannel(label, channelId, ensurePanel) {
  console.log(`[painel:${label}] buscando canal pelo ID ${channelId}`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`[painel:${label}] canal não encontrado (${channelId})`);
      return;
    }
    if (!channel.isTextBased() || !channel.messages) {
      console.error(`[painel:${label}] canal encontrado, mas não é um canal de texto utilizável (${channelId})`);
      return;
    }
    console.log(`[painel:${label}] canal encontrado: #${channel.name || "sem-nome"} (${channel.id})`);
    const permissions = channel.permissionsFor(client.user);
    const requiredPermissions = [
      ["ViewChannel", PermissionFlagsBits.ViewChannel],
      ["ReadMessageHistory", PermissionFlagsBits.ReadMessageHistory],
      ["SendMessages", PermissionFlagsBits.SendMessages],
      ["EmbedLinks", PermissionFlagsBits.EmbedLinks],
    ];
    const missing = permissions ? requiredPermissions.filter(([, flag]) => !permissions.has(flag)).map(([name]) => name) : requiredPermissions.map(([name]) => name);
    if (missing.length) {
      console.error(`[painel:${label}] permissões ausentes: ${missing.join(", ")}`);
      return;
    }
    console.log(`[painel:${label}] permissões necessárias confirmadas`);
    await ensurePanel(channel);
    console.log(`[painel:${label}] verificação concluída sem duplicação`);
  } catch (error) {
    console.error(`[painel:${label}] erro durante busca ou envio:`, error);
  }
}

function isStaff(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function ticketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Fechar Ticket").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_claim").setLabel("Assumir Ticket").setStyle(ButtonStyle.Primary),
  );
}

const ticketCategories = {
  parcerias: {
    label: "Parcerias",
    modalTitle: "Formulário • Parcerias",
    fields: [
      { id: "nick", label: "Nick", placeholder: "Informe seu nick dentro do servidor", required: false },
      { id: "server", label: "Nome do servidor/projeto", placeholder: "Qual o nome do seu servidor?", required: true },
      { id: "link", label: "Link/TXT do servidor", placeholder: "Cole o link ou informações do seu servidor", required: true, style: TextInputStyle.Paragraph },
    ],
  },
  suporte: {
    label: "Suporte",
    modalTitle: "Formulário • Suporte",
    fields: [
      { id: "nick", label: "Nick", placeholder: "Informe seu nick dentro do servidor", required: false },
      { id: "problem", label: "Dúvida/Problema", placeholder: "Qual é a sua dúvida ou problema?", required: true, maxLength: 512, style: TextInputStyle.Paragraph },
    ],
  },
  reserva: {
    label: "Reserva/Compra",
    modalTitle: "Formulário • Reserva/Compra",
    fields: [
      { id: "nick", label: "Nick", placeholder: "Informe seu nick dentro do servidor", required: false },
      { id: "product", label: "Produto/Serviço desejado", placeholder: "Ex: icons, banner, tela finl, thumbnail, artes", required: true },
      { id: "quantity", label: "Quantidade", placeholder: "Quantos itens você deseja?", required: true },
      { id: "coupon", label: "Código de desconto", placeholder: "Se você tiver um cupom de desconto, informe aqui", required: false },
    ],
  },
};

function ticketModal(category) {
  const config = ticketCategories[category];
  return new ModalBuilder()
    .setCustomId(`ticket_modal:${category}`)
    .setTitle(config.modalTitle)
    .addComponents(
      ...config.fields.map((field) => new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(field.id)
          .setLabel(field.label)
          .setPlaceholder(field.placeholder)
          .setRequired(field.required)
          .setStyle(field.style || TextInputStyle.Short)
          .setMaxLength(field.maxLength || 1000),
      )),
    );
}

function answerBox(label, value) {
  const safeValue = String(value).replace(/`/g, "ˋ").replace(/\n/g, " ");
  return `**${label}:** \`${safeValue}\``;
}

const commands = [
  {
    name: "sorteio",
    description: "Cria um sorteio no canal oficial.",
    default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
    options: [
      { name: "premio", description: "Prêmio do sorteio", type: 3, required: true },
      { name: "duracao", description: "Exemplo: 30m, 2h ou 1d", type: 3, required: true },
      { name: "ganhadores", description: "Quantidade de ganhadores", type: 4, required: true, min_value: 1, max_value: 20 },
    ],
  },
  { name: "suporte", description: "Publica o painel para abrir um atendimento." },
];

client.once("ready", async () => {
  console.log(`[ready] Discord conectado como ${client.user.tag}`);
  console.log(`[ready] canais configurados: sorteios=${GIVEAWAY_CHANNEL_ID}, suporte=${SUPPORT_CHANNEL_ID}`);
  readGiveaways();
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(process.env.ID_CLIENTE), { body: commands });
    console.log("[ready] comandos slash registrados");
  } catch (error) {
    console.error("[ready] erro ao registrar comandos slash; continuando com os painéis:", error);
  }
  await Promise.all([
    ensurePanelInChannel("sorteios", GIVEAWAY_CHANNEL_ID, ensureInfoEmbed),
    ensurePanelInChannel("suporte", SUPPORT_CHANNEL_ID, ensureSupportPanel),
  ]);
  for (const giveaway of giveaways.values()) {
    const delay = Math.max(0, giveaway.endsAt - Date.now());
    setTimeout(() => finishGiveaway(giveaway), delay);
  }
  console.log(`CraftShop Bot online como ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === "sorteio") {
    const duration = parseDuration(interaction.options.getString("duracao"));
    if (!duration) return interaction.reply({ content: "Duração inválida. Use formatos como `30m`, `2h` ou `1d` (máximo de 31 dias).", ephemeral: true });
    const channel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return interaction.reply({ content: "O canal de sorteios não foi encontrado ou não permite mensagens.", ephemeral: true });
    const giveaway = {
      id: `${Date.now()}-${interaction.user.id}`,
      prize: interaction.options.getString("premio"),
      winnerCount: interaction.options.getInteger("ganhadores"),
      endsAt: Date.now() + duration,
      channelId: GIVEAWAY_CHANNEL_ID,
      participants: [],
      status: "active",
    };
    const message = await channel.send({ embeds: [giveawayEmbed(giveaway)], components: [giveawayButtons(giveaway.id)] });
    giveaway.messageId = message.id;
    giveaways.set(giveaway.id, giveaway);
    saveGiveaways();
    setTimeout(() => finishGiveaway(giveaway), duration);
    return interaction.reply({ content: `Sorteio criado em ${channel}.`, ephemeral: true });
  }

  if (interaction.isChatInputCommand() && interaction.commandName === "suporte") {
    if (!isStaff(interaction)) return interaction.reply({ content: "Apenas a staff pode publicar o painel de suporte.", ephemeral: true });
    const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return interaction.reply({ content: "O canal de suporte não foi encontrado.", ephemeral: true });
    await ensureSupportPanel(channel);
    return interaction.reply({ content: `Painel publicado em ${channel}.`, ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId.startsWith("giveaway_join:")) {
    const giveaway = giveaways.get(interaction.customId.split(":")[1]);
    if (!giveaway) return interaction.reply({ content: "Este sorteio já foi encerrado.", ephemeral: true });
    const index = giveaway.participants.indexOf(interaction.user.id);
    if (index >= 0) {
      giveaway.participants.splice(index, 1);
      await interaction.reply({ content: "Você saiu do sorteio.", ephemeral: true });
    } else {
      giveaway.participants.push(interaction.user.id);
      await interaction.reply({ content: "Você está participando. Boa sorte!", ephemeral: true });
    }
    saveGiveaways();
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "support_category") {
    const category = interaction.values[0];
    if (!ticketCategories[category]) return interaction.reply({ content: "Essa categoria de atendimento não está disponível.", ephemeral: true });
    return interaction.showModal(ticketModal(category));
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_modal:")) {
    const category = interaction.customId.split(":")[1];
    const config = ticketCategories[category];
    if (!config) return interaction.reply({ content: "Essa categoria de atendimento não está disponível.", ephemeral: true });
    const answers = Object.fromEntries(config.fields.map((field) => [field.id, interaction.fields.getTextInputValue(field.id).trim()]));
    console.log(`[ticket] formulário recebido: categoria=${category}, usuário=${interaction.user.id}`);
    const guild = interaction.guild;
    const existing = guild.channels.cache.find((channel) => channel.topic?.startsWith(`ticket-owner:${interaction.user.id}`));
    if (existing) return interaction.reply({ content: `Você já possui um atendimento aberto: ${existing}.`, ephemeral: true });
    const staffRoles = STAFF_ROLE_IDS.filter((roleId) => guild.roles.cache.has(roleId));
    const missingStaffRoles = STAFF_ROLE_IDS.filter((roleId) => !guild.roles.cache.has(roleId));
    if (missingStaffRoles.length) console.error(`[ticket] cargos de staff não encontrados no servidor: ${missingStaffRoles.join(", ")}`);
    const categoryName = config.label;
    const safeUsername = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 12) || interaction.user.id.slice(-6);
    const ticket = await guild.channels.create({
      name: `ticket-${category}-${safeUsername}`,
      type: ChannelType.GuildText,
      parent: TICKET_CATEGORY_ID,
      topic: `ticket-owner:${interaction.user.id};ticket-category:${category}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...staffRoles.map((roleId) => ({
          id: roleId,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
        })),
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    const summary = [
      answers.nick && answerBox("Nick", answers.nick),
      answers.server && answerBox("Nome do servidor/projeto", answers.server),
      answers.link && answerBox("Link/TXT do servidor", answers.link),
      answers.problem && answerBox("Dúvida/Problema", answers.problem),
      answers.product && answerBox("Produto/Serviço desejado", answers.product),
      answers.quantity && answerBox("Quantidade", answers.quantity),
      answers.coupon && answerBox("Código de desconto", answers.coupon),
    ].filter(Boolean).join("\n");
    await ticket.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`Ticket Aberto • ${categoryName}`)
          .setColor(TICKET_COLORS[category] || BRAND.blue)
          .setDescription(`${interaction.user} criou um ticket de **${categoryName}**.\n\n**Formulário de atendimento:**\n${summary}`)
          .setFooter({ text: "Craft Shop • atendimento" }),
      ],
      components: [ticketControls()],
    });
    await interaction.reply({ content: `Seu atendimento foi aberto: ${ticket}.`, ephemeral: true });
  }

  if (interaction.isButton() && ["ticket_close", "ticket_claim"].includes(interaction.customId)) {
    const channel = interaction.channel;
    if (!channel?.isTextBased() || !channel.topic?.startsWith("ticket-owner:")) {
      return interaction.reply({ content: "Este botão só funciona dentro de um ticket.", ephemeral: true });
    }
    const ownerId = channel.topic.replace("ticket-owner:", "");
    if (interaction.customId === "ticket_claim") {
      if (!isStaff(interaction)) return interaction.reply({ content: "Apenas a staff pode reivindicar tickets.", ephemeral: true });
      await channel.send(`📜 Ticket reivindicado por ${interaction.user}.`);
      return interaction.reply({ content: "Você reivindicou este ticket.", ephemeral: true });
    }
    if (!isStaff(interaction) && interaction.user.id !== ownerId) {
      return interaction.reply({ content: "Apenas o autor do ticket ou a staff pode fechá-lo.", ephemeral: true });
    }
    await interaction.reply({ content: "Este ticket será fechado em 5 segundos.", ephemeral: true });
    setTimeout(() => channel.delete("Ticket fechado").catch(() => {}), 5000);
  }
});

client.login(process.env.DISCORD_TOKEN);