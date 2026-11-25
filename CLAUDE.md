# Pocket Master MIDI Controller

Controlador MIDI de pé (8 footswitches com LED e um display de 7 segmentos para o BPM) para a pedaleira Sonicake Pocket Master rodando a **CFW** (https://pocketmaster-cfw.guitar-training-generator.com/).

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
- `ui/`: footswitches, LEDs e o display TM1637 virtual. Só renderiza o estado e chama o core.
- O tempo sempre entra como parâmetro (`nowMs`). Nada de `Date.now()` dentro do core, para os testes serem determinísticos.

## Hardware alvo (fase 2)

- ESP32 (S3, se for usar USB host), conectando à pedaleira como **cliente BLE MIDI**
- 8 footswitches, cada um com 1 LED
- Display de 7 segmentos, 4 dígitos, com TM1637 (CLK/DIO em 2 GPIOs), só para o BPM. Biblioteca TM1637Display
- Futuro: jack de pedal de expressão → CC 16 (EXP A)

## Layout dos botões (2×4)

| | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| **Cima** | Preset 1 | Preset 2 | Preset 3 | Preset 4 |
| **Baixo** | Scene 1 | Scene 2 | Stomp FS1 | Tap |

| Botão | Toque | Segurar (≥ 450 ms) | Dispara em |
|---|---|---|---|
| Preset 1–4 | carrega o preset do botão no banco atual | carrega o preset do botão no **outro** banco | toque: release; segurar: ao completar 450 ms |
| Scene 1 / 2 | ativa a cena; se ela já está ativa, **desativa** | — | press |
| Stomp FS1 | alterna o STOMP FS1 da pedaleira | freeze enquanto segurar (momentâneo) | toque: release; freeze: liga ao completar 450 ms, desliga no release |
| Tap | tap tempo | — | press |

## Regras de comportamento

### Bancos e presets
- Dois bancos **virtuais, do controlador**, com 4 presets cada: banco A = P01–P04, banco B = P05–P08. Não usar os CC 22/23 da pedaleira.
- O banco atual é o banco do preset carregado (`loadedPreset / 4`). Não existe banco "pendente".
- Cada botão tem um endereço em cada banco: botão N = P0N no A e P0(N+4) no B.
- Toque no botão N carrega o preset N do banco atual.
- Segurar o botão N carrega o preset N do outro banco (ex.: em P01, segurar o 2 carrega P06; segurar o 2 de novo volta para P02). Dispara uma vez por hold, assim que completa 450 ms, e o release não faz nada.
- Os presets disparam no release porque o mesmo botão tem toque longo.
- Preset = `bank * 4 + slot` (índice base 0). É enviado como CC 1 = índice + 1 (`PRESET_INDEX_OFFSET`).

### LEDs dos presets
- Só o LED do botão do preset carregado acende.
- Banco A: aceso fixo. Banco B: pisca (500 ms de período, metade aceso), no relógio absoluto (`nowMs`).

### Cenas
- Duas cenas por preset (SC1 e SC2), e no máximo uma ativa.
- Apertar uma cena inativa ativa ela (e desativa a outra).
- **Apertar a cena que já está ativa desativa ela**, e o som volta ao preset base. Não fica nenhuma cena ativa.
- Carregar um preset zera o estado de cena (nenhuma ativa).
- LED da cena aceso = cena ativa.

### Tap e LED do tap
- Cada toque envia CC 26 = 127. O BPM é a média dos intervalos dos últimos 4 toques; toques com mais de 2 s de diferença são descartados. Limite de 40–260 BPM.
- **O LED do Tap pisca no BPM atual como um flash curto no início de cada tempo**, não como 50% aceso e 50% apagado. Flash de ~60 ms aceso, o resto do tempo apagado.
- Cada toque no Tap **realinha a fase**: o flash acontece no momento do toque e os próximos seguem a partir dali.
- O relógio de tempos fica no core e avança via `tick(nowMs)`.
- Segurar o Tap não faz nada além do tap.

### Freeze (segurar o Stomp FS1)
- Momentâneo: segurar o Stomp FS1 por 450 ms liga (CC 114 = 127), soltar desliga (CC 114 = 0).
- Indicado no display: `F` no primeiro dígito enquanto ligado. Não mexe no tap tempo nem no estado do stomp.
- Trocar de preset não mexe no freeze.
- Só tem efeito audível se o preset usar o reverb **Freeze** no bloco RVB.

### Stomp FS1
- Cada toque envia CC 80 = 127 no release (o botão tem toque longo). Na CFW, qualquer valor ≥ 64 alterna o grupo STOMP FS1 (é toggle, não on/off).
- LED aceso = estado local ligado. Carregar um preset volta para desligado (suposição: sem feedback da pedaleira).

## Display (TM1637, 4 dígitos)

- Mostra o BPM nos 3 últimos dígitos, alinhado à direita e sem zeros à esquerda (` 120`, `  40`). O primeiro dígito mostra `F` (0x71) enquanto o freeze está ligado (`F120`).
- O modelo é `getDisplay(state)` em `core/display.ts`: os 4 bytes de segmentos que o chip recebe (bit 0 = a … bit 6 = g, bit 7 = ponto/dois-pontos). No firmware vão direto para `TM1637Display::setSegments()`.
- Banco, preset, cena e stomp aparecem só pelos LEDs.

## Mapa MIDI (CFW, mapa **Stock**)

| Função | Mensagem |
|---|---|
| Carregar preset | CC 1 = número do preset, base 1 (CC 1 = 0 não faz nada; P01 = 1, a confirmar) |
| Scene 1 / 2 | CC 82 / 83 (a confirmar) |
| Desativar cena | a confirmar (candidato: CC 85) |
| Tap | CC 26 = 127 |
| Freeze on / off (segurar Stomp FS1) | CC 114 = 127 / 0 |
| STOMP FS1 | CC 80 = 127 (toggle, ≥ 64) |
| EXP A (futuro) | CC 16, 0–127 contínuo |

Configuração na pedaleira: mapa **Stock**, MIDI CH (ALL ou o canal escolhido) e "same preset again" em **OFF**.

## Sem feedback da pedaleira

A CFW **não tem MIDI out** (está nos planos dela). Todo estado (preset, cena, freeze) é do controlador e pode ficar dessincronizado se alguém mexer direto na pedaleira. Não tente ler estado da pedaleira.

## A confirmar no MIDI monitor da CFW (Settings → MIDI)

1. ~~Se CC 1 = 0 carrega o P01.~~ Não carrega (testado na pedaleira). Falta confirmar que CC 1 = 1 carrega o P01 e CC 1 = 8 carrega o P08.
2. Qual CC (82, 83 ou 85) corresponde a cada cena, e como se volta para "sem cena". Se não existir mensagem para sair da cena, decidir um fallback antes de implementar.

Não chute esses valores no código: deixe-os em um único arquivo de constantes (`core/midiMap.ts`) para trocar depois de testar.

## Convenções

- Código, nomes e textos da UI em inglês.
- TDD no `core/`: cada regra acima deve ter teste (toque e hold dos presets, display do BPM, LED fixo/piscando por banco, cena toggle, fase do LED do tap, toggle do stomp, freeze momentâneo no hold do stomp).
- Mockup de referência no Claude Design (do layout antigo, com tela e stomps): https://claude.ai/artifact/5b9qYrhwMJHGfdrTEn5jC5
