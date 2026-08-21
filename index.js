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
  PermissionFlagsBits,
  REST,
  Routes,
} = require("discord.js");

const required = ["DISCORD_TOKEN", "ID_CLIENTE"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Variável obrigatória ausente: ${name}`);
}

const GIVEAWAY_CHANNEL_ID = "1363301153919729780";
const SUPPORT_CHANNEL_ID = "1363301154351616017";
const DATA_FILE = path.join(__dirname, "data", "giveaways.json");
const BRAND = {
  green: 0x22c55e,
  orange: 0xf97316,
  blue: 0x38bdf8,
  purple: 0xa855f7,
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
  const message = existing || await channel.send({ embeds: [embed] });
  if (!message.pinned) await message.pin().catch(() => {});
}

async function ensureSupportPanel(channel) {
  const messages = await channel.messages.fetch({ limit: 50 });
  const existing = messages.find((message) => message.author.id === client.user.id && ["Suporte", "Suporte CraftShop"].includes(message.embeds[0]?.title));
  const embed = new EmbedBuilder()
    .setTitle("Suporte")
    .setColor(BRAND.purple)
    .setDescription("Precisando de ajuda? Crie um ticket aqui e nossa equipe vai te atender o mais rápido possível.")
    .addFields(
      { name: "🎮 Atendimento Craft Shop", value: "Nossa equipe está pronta para ajudar com seus pedidos e produtos digitais.", inline: false },
      { name: "🧱 Como funciona", value: "Clique abaixo, explique o que precisa e aguarde a nossa equipe.", inline: false },
    )
    .setFooter({ text: "Craft Shop • thumbnails, banners e artes personalizadas" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("support_open").setLabel("Criar Ticket").setEmoji("🎮").setStyle(ButtonStyle.Primary),
  );
  const message = existing || await channel.send({ embeds: [embed], components: [row] });
  if (!message.pinned) await message.pin().catch(() => {});
}

function isStaff(interaction) {
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function ticketControls() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId("ticket_close").setLabel("Fechar Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId("ticket_claim").setLabel("Reivindicar Ticket").setEmoji("📜").setStyle(ButtonStyle.Secondary),
  );
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
  readGiveaways();
  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationCommands(process.env.ID_CLIENTE), { body: commands });
  const giveawayChannel = await client.channels.fetch(GIVEAWAY_CHANNEL_ID).catch(() => null);
  if (giveawayChannel?.isTextBased()) await ensureInfoEmbed(giveawayChannel);
  const supportChannel = await client.channels.fetch(SUPPORT_CHANNEL_ID).catch(() => null);
  if (supportChannel?.isTextBased()) await ensureSupportPanel(supportChannel);
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

  if (interaction.isButton() && interaction.customId === "support_open") {
    const guild = interaction.guild;
    const existing = guild.channels.cache.find((channel) => channel.topic === `ticket-owner:${interaction.user.id}`);
    if (existing) return interaction.reply({ content: `Você já possui um atendimento aberto: ${existing}.`, ephemeral: true });
    const staffRoles = guild.roles.cache.filter((role) => role.id !== guild.roles.everyone.id && role.permissions.has(PermissionFlagsBits.ManageGuild));
    const ticket = await guild.channels.create({
      name: `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 18) || interaction.user.id.slice(-6)}`,
      type: ChannelType.GuildText,
      parent: interaction.channel.parentId || undefined,
      topic: `ticket-owner:${interaction.user.id}`,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ...staffRoles.map((role) => ({
          id: role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels],
        })),
      ],
    });
    await ticket.send({
      embeds: [new EmbedBuilder().setTitle("Ticket Aberto").setColor(0x22c55e).setDescription(`${interaction.user} criou um novo ticket. Explique como podemos ajudar.`)],
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