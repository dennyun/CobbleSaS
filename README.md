# 🎮 Cobblemon Launcher

Launcher oficial do servidor Cobblemon para Minecraft Fabric 1.21.1.

---

## 📦 Para o Administrador do Servidor

### Pré-requisitos
- [Node.js 18+](https://nodejs.org/)
- [Git](https://git-scm.com/)

### Configuração inicial

#### 1. Instalar dependências
```bash
cd cobblemon-launcher
npm install
```

#### 2. Configurar o manifest
Edite `src/updater.js` e mude o `MANIFEST_URL` para o endereço do seu repositório:
```js
const MANIFEST_URL = 'https://raw.githubusercontent.com/SEU_USUARIO/SEU_REPOSITORIO/main/manifest.json';
```

#### 3. Hospedar o modpack no GitHub
1. Crie um repositório no GitHub (ex: `cobblemon-modpack`)
2. Adicione o `manifest.json` à raiz do repositório
3. Compacte seus mods em `modpack.zip`
4. Vá em **Releases** → **Create a new release**
5. Faça upload do `modpack.zip` e publique
6. Copie a URL de download e coloque no `manifest.json`

#### 4. Adicionar assets
Coloque em `/assets/`:
- `icon.png` — logo do servidor (512x512 recomendado)
- `icon.ico` — para Windows
- `icon.icns` — para macOS
- `bg.png` — imagem de fundo do launcher

#### 5. Testar localmente
```bash
npm start
```

#### 6. Gerar os instaladores

**Windows (.exe):**
```bash
npm run build:win
```

**macOS (.dmg):**
```bash
npm run build:mac
```

**Linux (.AppImage):**
```bash
npm run build:linux
```

Os arquivos gerados ficam em `/dist/`.

---

### 🚀 Como Publicar uma Nova Versão do Modpack (Atualização)

Sempre que você quiser adicionar, remover ou atualizar mods, siga este passo a passo rigoroso para garantir que todos os jogadores recebam a atualização automaticamente.

**Passo 1: Preparar os arquivos**
1. No seu computador, abra a pasta onde estão os mods atualizados (ex: `.minecraft` ou `.cobblesas`).
2. Selecione a pasta `mods` (e se houver, as pastas `config`, `resourcepacks`, etc, que deseja enviar).
3. Clique com o botão direito e compacte para um arquivo `.zip`.
   *⚠️ Atenção: A estrutura interna do seu arquivo ZIP deve possuir a pasta `mods/` logo na raiz do ZIP. Não compacte a pasta base inteira colocando os arquivos dentro de uma subpasta.*

**Passo 2: Hospedar o arquivo (Criar Release no GitHub)**
1. Acesse o repositório do seu launcher no GitHub.
2. Na lateral direita, clique em **Releases** e depois em **Draft a new release**.
3. Em "Choose a tag", digite a nova versão (ex: `v1.1.0`) e clique em "Create new tag".
4. Preencha o título (ex: `Atualização 1.1.0 - Novos Mods`).
5. Arraste o seu arquivo `modpack.zip` (gerado no Passo 1) para a caixa de anexos e espere o upload terminar.
6. Clique no botão verde **Publish release**.

**Passo 3: Pegar o Link Direto de Download**
1. Na página do Release que você acabou de criar, vá até a seção "Assets".
2. Clique com o botão direito no arquivo `modpack.zip` e escolha **Copiar endereço do link** (Copy link address).
   *O link deve ser algo parecido com: `https://github.com/SeuUsuario/SeuRepo/releases/download/v1.1.0/modpack.zip`*

**Passo 4: Atualizar o Cérebro do Launcher (manifest.json)**
1. Volte para a página inicial do repositório no GitHub.
2. Abra o arquivo `manifest.json` e clique no ícone do **Lápis** para editar.
3. Altere o arquivo colando as novas informações:
   ```json
   {
     "name": "CobbleSaS Modpack",
     "version": "1.1.0",
     "minecraft_version": "1.21.1",
     "fabric_loader_version": "0.16.9",
     "download_url": "COLE_AQUI_O_LINK_DIRETO_DO_PASSO_3",
     "changelog": [
       "Adicionado mod de minimapa",
       "Melhoria de performance",
       "Bug da mochila corrigido"
     ]
   }
   ```
4. Desça até o final da página de edição e clique em **Commit changes...** (salvar).

**Passo 5: Magia acontecendo!**
Assim que você salvar o `manifest.json`, em no máximo 1 minuto todos os jogadores que abrirem o launcher verão o botão verde "JOGAR" ficar amarelo e exibir **"ATUALIZAR"**.
O launcher cuidará sozinho de:
- Baixar o seu novo zip.
- Apagar apenas os mods oficiais antigos.
- Extrair os novos mods.
- Iniciar o jogo.

---

## 🎮 Para os Jogadores

1. Baixe o launcher em `#downloads` do Discord
2. Instale e abra o launcher
3. Se aparecer **"ATUALIZAR"** → clique para baixar o modpack
4. Se aparecer **"JOGAR"** → clique para abrir o Minecraft
5. No launcher do Minecraft, selecione o perfil **Fabric 1.21.1** e jogue!

> **Requisitos:** Java 21+, Minecraft Java Edition, mínimo 4GB RAM alocado

---

## ⚙️ Estrutura do Projeto

```
cobblemon-launcher/
├── main.js                   ← Processo principal Electron
├── preload.js                ← Bridge segura IPC
├── renderer/
│   ├── index.html            ← Interface
│   ├── style.css             ← Design
│   └── renderer.js           ← Lógica da UI
├── src/
│   ├── updater.js            ← Verificação de versão + download
│   ├── fabric-installer.js   ← Instalação automática do Fabric
│   └── minecraft-launcher.js ← Lança o Minecraft
├── assets/                   ← Imagens e ícones
└── manifest.json             ← Exemplo de manifest
```
