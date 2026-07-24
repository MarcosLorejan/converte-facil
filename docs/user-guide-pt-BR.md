# Instalar o Converte Fácil (Windows)

Guia curto para o dia a dia: baixar → instalar → converter o primeiro arquivo. Sem passos de programação.

**English:** [Install guide](user-guide-en.md)

## 1. Baixar

1. Abra a página de [Releases](https://github.com/MarcosLorejan/converte-facil/releases) (ou o link de download que você recebeu).
2. Baixe o instalador do Windows: um arquivo com nome parecido com **`Converte Facil_…_x64-setup.exe`**.
3. Salve em um lugar fácil de achar (a pasta Downloads serve).

> **Espaço para captura de tela:** página de Releases com o `.exe` destacado  
> `docs/images/pt-01-download.png`

## 2. Instalar

1. Dê dois cliques no arquivo de instalação.
2. Se o Windows perguntar “Deseja permitir…?”, escolha **Sim**.
3. Escolha **Português** ou **English** se aparecer a opção de idioma.
4. Siga as etapas. Deixe marcada a opção de **atalho na área de trabalho** se quiser o ícone na mesa.
5. Conclua o instalador.

O app é instalado para o seu usuário do Windows (em geral sem senha de administrador).

> **Espaço para captura de tela:** tela do instalador  
> `docs/images/pt-02-instalador.png`

## 3. Abrir o app

- Use o ícone na **área de trabalho**, ou  
- Abra o menu **Iniciar** → **Converte Facil** → **Converte Facil**

Se quiser, mude o **Idioma** (English / Português) no topo da janela.

> **Espaço para captura de tela:** tela principal com seletor de idioma e botões Imagens / PDF / Documentos  
> `docs/images/pt-03-principal.png`

## 4. Converter o primeiro arquivo (imagens)

1. Clique em **Imagens**.
2. Solte uma foto na caixa grande, ou clique em **Escolher arquivos**.  
   Fotos de celular em **HEIC** / **HEIF** (e **AVIF**) são aceitas quando o ImageMagick do app tem suporte a esses formatos.
3. Em **Converter para**, escolha um formato (por exemplo **JPG** ou **PNG**).
4. Clique em **Converter e salvar** e escolha a pasta do resultado.
5. Espere a mensagem de sucesso.

> **Espaço para captura de tela:** lista de fotos + formato + botão Converter  
> `docs/images/pt-04-converter-imagem.png`

## 5. Converter um PDF (opcional)

1. Clique em **PDF**.
2. Escolha um PDF, selecione **PNG** ou **JPG** e **Converter e salvar** em uma pasta.  
   Cada página vira uma imagem (`page-001`, `page-002`, …).
3. Ou use **Transformar fotos em PDF** para juntar fotos em um único PDF.

> **Espaço para captura de tela:** painel do modo PDF  
> `docs/images/pt-05-pdf.png`

## 6. Converter Word ou Excel em PDF (opcional)

O modo Documentos precisa do **LibreOffice** instalado no PC (ele não vem dentro do instalador do Converte Fácil).

1. Clique em **Documentos**.
2. Se o app disser que o LibreOffice não foi encontrado, use o link de download, instale o LibreOffice pelo site oficial e clique em **Verificar de novo**.
3. Escolha um arquivo **Word (`.docx`)** ou **Excel (`.xlsx`)**.
4. Clique em **Converter e salvar**, escolha a pasta e aguarde o PDF.

> **Espaço para captura de tela:** modo Documentos + guia do LibreOffice  
> `docs/images/pt-06-documentos.png`

## Desinstalar

1. Abra **Configurações** do Windows → **Aplicativos** → **Aplicativos instalados**.
2. Encontre **Converte Facil** → **Desinstalar**.

Isso remove o app, o atalho do menu Iniciar e o atalho da área de trabalho.

## Componentes de código aberto (PDF)

A conversão de PDF usa o **Ghostscript**, software livre sob a **GNU AGPL v3**. O instalador oficial para Windows pode incluir o Ghostscript. O código-fonte da versão do Ghostscript que distribuímos está disponível pela Artifex (veja [third-party/NOTICE](../third-party/NOTICE) e [docs/sidecars.md](sidecars.md) no repositório do projeto).

## Precisa de ajuda?

- Os arquivos ficam no seu computador — nada é enviado para a internet.
- Se alguma ferramenta aparecer como **Não encontrado**, reinstale a partir de um instalador completo (o setup oficial já inclui as ferramentas de conversão).
- Para quem desenvolve (código-fonte): veja o [README](../README.md).
