# 🛡️ Política de Segurança e Estabilidade (CobbleSaS Launcher)

O **CobbleSaS Launcher** foi projetado com uma arquitetura de segurança rigorosa (Security-First) para proteger tanto a integridade da máquina do jogador quanto o ecossistema do servidor. Abaixo estão detalhadas todas as camadas de defesa e estabilidade implementadas no código.

---

## 1. Isolamento de Processos (Sandbox)
Para evitar ataques maliciosos no cliente, a janela de visualização do Launcher e o núcleo do sistema rodam separadamente:
* **Context Isolation:** O Front-end (UI) não tem acesso direto aos arquivos do Windows. Todo e qualquer comando (como "salvar configurações" ou "abrir pasta") passa por uma ponte ultra-vigiada (via `preload.js`).
* **Node Integration Desativada:** Scripts HTML do launcher não conseguem executar código `Node.js` arbitrário.

## 2. Prevenção de Injeção de Código (Command Injection)
* Todos os parâmetros recebidos da Nuvem (ex: versão do Minecraft `1.21.1` e do Fabric `0.16.9`) passam por **Regex rígidos** (`/[^a-zA-Z0-9.-]/g`).
* Essa blindagem impede que um eventual ataque ao servidor do manifesto consiga injetar códigos maliciosos no momento em que o launcher invoca o processo do Java (evitando invasão via Argument Injection).
* Os nomes dos jogadores (`nickname`) são truncados e limitados a caracteres seguros (letras, números e underlines), protegendo o sistema de bans falsos e corrupção de sessão.

## 3. Proteção contra Path Traversal (Anti-Deleção de Disco)
O sistema de auto-update deleta automaticamente mods obsoletos da pasta raiz. Para evitar que o sistema seja manipulado para apagar arquivos vitais do SO (como o Windows):
* O limpador de atualização usa funções criptográficas de caminhos (`path.basename()`), garantindo que o comando de limpeza de arquivo fique 100% confinado e trancado dentro da pasta estrita `mods/`.
* A escolha de diretório de instalação passa por sanitização que **proíbe** caminhos destrutivos como `C:\`, `C:\Windows` ou `/bin`.

## 4. Defesa contra Man-in-the-Middle (Redes)
* O motor de download do modpack (`updater.js`) possui um verificador que exige estritamente a comunicação por **HTTPS**.
* Se o manifesto for alterado por engano para um link `http://` não-criptografado, o download é instantaneamente barrado, evitando que operadoras de internet ou invasores de Wi-Fi alterem o arquivo `.zip` (como injeção de malware no Java) enquanto o download ocorre.

## 5. Mitigação de Cross-Site Scripting (Anti-XSS Visual)
A comunicação com a API de status do servidor (`mcstatus.io`) ocorre em tempo real.
* Para proteger os jogadores de APIs corrompidas ou envenenamento de cache que poderiam enviar pop-ups falsos, todos os dados recebidos externamente são forçosamente convertidos em **Tipagem Numérica** (estrita) ou injetados por manipuladores `textContent`, desarmando qualquer tentativa de enviar códigos HTML maliciosos para a tela do launcher.

## 6. Estabilidade de Falhas (Graceful Failure)
Se a internet cair, o servidor sair do ar ou o disco rígido do usuário lotar, o launcher não "quebrará" o computador nem sofrerá tela de crash:
* **Streams Protegidas:** O núcleo de gravação de disco possui eventos de erro contidos. Falhas de disco ou permissões resultam apenas em uma mensagem "Erro de gravação" no visual, sem que o processo sofra abortos (*Unhandled Promise Rejection*).
* O monitoramento do servidor foi projetado com funções `try/catch` independentes, garantindo que mesmo se o host principal cair, o launcher continuará liso, oferecendo apenas o status "Servidor indisponível" na lateral.

---
*CobbleSaS Security Patch - v1.0.0*
