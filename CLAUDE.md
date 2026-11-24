# Pocket Master MIDI Controller

Controlador MIDI de pé (8 footswitches + tela OLED) para a pedaleira Sonicake Pocket Master rodando a **CFW** (https://pocketmaster-cfw.guitar-training-generator.com/).

- **Fase 1 (este repo, agora):** POC web que simula o controlador e envia MIDI de verdade pela Web MIDI API.
- **Fase 2:** firmware para ESP32 com o mesmo comportamento.

A lógica do controlador deve ser escrita de forma que dê para portar para o firmware sem reescrever as regras.

## Stack (fase 1)

- React + Vite + TypeScript
- Testes: Vitest, com TDD na lógica do controlador
- MIDI: duas saídas, e o BLE tem prioridade quando conectado:
  - **BLE direto via Web Bluetooth** (`midi/useBluetoothMidi.ts`), sem parear no sistema. Se a pedaleira estiver conectada ao macOS (Audio MIDI Setup), desconecte lá antes, porque ela aceita uma conexão por vez. Logo depois do GATT connect a Pocket Master derruba a conexão e volta; a reconexão é reativa (no `gattserverdisconnected`), portada do universal-midi-controller.
  - **Web MIDI API** (`midi/useMidi.ts`) para USB ou para BLE pareado no sistema.

## Arquitetura

- `core/`: lógica pura, sem React e sem MIDI. Uma máquina de estado que recebe eventos (`press(id)`, `release(id)`, `tick(nowMs)`) e devolve o novo estado mais a lista de mensagens MIDI a enviar. É **toda** a regra de negócio, e é ela que vai para o firmware.
- `midi/`: adaptadores de saída (Web MIDI e BLE MIDI via Web Bluetooth) e codificação dos bytes (`ccBytes`, `blePacket`).
- `ui/`: tela 128×64 e footswitches. Só renderiza o estado e chama o core.
- O tempo sempre entra como parâmetro (`nowMs`). Nada de `Date.now()` dentro do core, para os testes serem determinísticos.

## Hardware alvo (fase 2)

- ESP32 (S3, se for usar USB host), conectando à pedaleira como **cliente BLE MIDI**
- Tela OLED 128×64: SSD1306 0.96″ ou SH1106 1.3″ (ainda decidindo). Biblioteca U8g2
- 8 footswitches, cada um com 1 LED
- Futuro: jack de pedal de expressão → CC 16 (EXP A)

## Layout dos botões (2×4)

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **Cima** | Stomp 1 | Stomp 2 | Scene 1 | Scene 2 |
| **Baixo** | Preset 1 | Preset 2 | Preset 3 | Tap |

| Botão | Toque | Segurar (≥ 450 ms) | Dispara em |
|---|---|---|---|
| Stomp 1 / 2 | alterna o grupo STOMP FS1 / FS2 | — | press |
| Scene 1 / 2 | ativa a cena; se ela já está ativa, **desativa** | — | press |
| Preset 1 / 2 / 3 | carrega o preset do slot no banco exibido | P1: bank −, P3: bank +, P2: nada | release |
| Tap | tap tempo | freeze enquanto segura | press |

## Regras de comportamento

### Bancos e presets
- Os bancos são **virtuais, do controlador**: 3 presets por banco. Não usar os CC 22/23 da pedaleira.
- 50 presets user (P01–P50) → 17 bancos (B01–B17). O B17 tem só P49 e P50; o slot 3 dele não faz nada.
- Preset do slot = `bank * 3 + slot` (índice base 0). É enviado como CC 1 = índice + 1 (`PRESET_INDEX_OFFSET`).
- Trocar de banco segurando o botão **não carrega preset**: o banco fica "pendente" até apertar um Preset. Enquanto está pendente, o `Bxx` aparece invertido na tela.
- Bank −/+ dá a volta (B01 ↔ B17).
- Os presets disparam no release porque o mesmo botão tem toque longo.

### Cenas
- Duas cenas por preset (SC1 e SC2), e no máximo uma ativa.
- Apertar uma cena inativa ativa ela (e desativa a outra).
- **Apertar a cena que já está ativa desativa ela**, e o som volta ao preset base. Não fica nenhuma cena ativa.
- Carregar um preset zera o estado de cena (nenhuma ativa).
- LED da cena aceso = cena ativa.

### Stomps
- Cada toque alterna. Sempre enviar valor 127 (a CFW só reage a ≥ 64; alternar 0/127 só funciona em um a cada dois toques).
- Carregar um preset zera o estado local dos stomps (a pedaleira não informa o estado real, veja "Sem feedback").

### Tap e LED do tap
- Cada toque envia CC 26 = 127. O BPM é a média dos intervalos dos últimos 4 toques; toques com mais de 2 s de diferença são descartados. Limite de 40–260 BPM.
- **O LED do Tap pisca no BPM atual como um flash curto no início de cada tempo**, não como 50% aceso e 50% apagado. Flash de ~60 ms aceso, o resto do tempo apagado.
- Cada toque no Tap **realinha a fase**: o flash acontece no momento do toque e os próximos seguem a partir dali.
- O relógio de tempos fica no core e avança via `tick(nowMs)`.

### Freeze
- Segurar o Tap por ≥ 450 ms envia CC 114 = 127 (liga). Soltar envia CC 114 = 0 (desliga).
- O toque que iniciou o hold também conta como tap (CC 26). Isso é aceitável.
- Enquanto o freeze está ativo, o LED do Tap fica aceso fixo e a tag FRZ fica invertida na tela.
- Só tem efeito audível se o preset usar o reverb **Freeze** no bloco RVB.

## Tela (128×64, 1 bit)

```
┌────────────────────────────────┐
│ 120 BPM                    FRZ │  header: 16 px (faixa amarela nos SSD1306 bicolor)
├────────────────────────────────┤
│                                │
│  B01                     P01   │  content: 48 px, fonte ~18 px
│                                │
└────────────────────────────────┘
```
- Header: BPM à esquerda, FRZ à direita (invertido quando ativo). FRZ fica do lado direito porque o Tap é o botão do canto inferior direito.
- Content: `Bxx` à esquerda (banco exibido, invertido se pendente) e `Pxx` à direita (preset carregado).
- Cena, stomps e slot ativo **não** aparecem na tela; quem mostra isso são os LEDs.
- Textos da UI em inglês.

## Mapa MIDI (CFW, mapa **Stock**)

| Função | Mensagem |
|---|---|
| Carregar preset | CC 1 = número do preset, base 1 (CC 1 = 0 não faz nada; P01 = 1, a confirmar) |
| Stomp FS1 / FS2 | CC 71 / CC 72 = 127 |
| Scene 1 / 2 | CC 82 / 83 (a confirmar) |
| Desativar cena | a confirmar (candidato: CC 85) |
| Tap | CC 26 = 127 |
| Freeze on / off | CC 114 = 127 / 0 |
| EXP A (futuro) | CC 16, 0–127 contínuo |

Configuração na pedaleira: mapa **Stock**, MIDI CH (ALL ou o canal escolhido) e "same preset again" em **OFF**.

## Sem feedback da pedaleira

A CFW **não tem MIDI out** (está nos planos dela). Todo estado (preset, cena, stomps, freeze) é do controlador e pode ficar dessincronizado se alguém mexer direto na pedaleira. Não tente ler estado da pedaleira.

## A confirmar no MIDI monitor da CFW (Settings → MIDI)

1. ~~Se CC 1 = 0 carrega o P01.~~ Não carrega (testado na pedaleira). Falta confirmar que CC 1 = 1 carrega o P01 e CC 1 = 50 carrega o P50.
2. Qual CC (82, 83 ou 85) corresponde a cada cena, e como se volta para "sem cena". Se não existir mensagem para sair da cena, decidir um fallback antes de implementar.
3. Se CC 71/72 e CC 80/81 se comportam igual para os stomps.

Não chute esses valores no código: deixe-os em um único arquivo de constantes (`core/midiMap.ts`) para trocar depois de testar.

## Convenções

- Código, nomes e textos da UI em inglês.
- TDD no `core/`: cada regra acima deve ter teste (bancos pendentes, wrap de banco, cena toggle, fase do LED do tap, hold do freeze).
- Mockup de referência no Claude Design: https://claude.ai/artifact/5b9qYrhwMJHGfdrTEn5jC5
