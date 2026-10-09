# Controle de Gastos da Família

Aplicativo web instalável (PWA) e versão portátil para Windows.

## Separar os dados por conta do Supabase

O banco precisa receber a migração de isolamento antes de usar esta versão. Abra `supabase\isolamento-contas.sql`, substitua `COLOQUE_EMAIL_DA_CONTA_PRINCIPAL_AQUI` pelo e-mail da conta que deve manter as despesas e dívidas atuais e execute o script no SQL Editor do Supabase. Ele atribui os registros antigos sem proprietário a essa conta e aplica políticas RLS para que cada usuário só consulte e altere os próprios registros.

Execute a migração uma única vez antes de distribuir a versão atualizada. Não apague nem recrie as tabelas. O app também filtra as consultas pelo ID da conta autenticada, mas a segurança efetiva é garantida pelas políticas no banco.

## Gerar o executável para Windows

Requer Node.js e npm instalados. No PowerShell, dentro desta pasta, execute:

```powershell
npm.cmd install
npm.cmd run dist
```

O executável portátil será criado na raiz desta pasta como `Controle de Gastos.exe` e também em `dist\Controle de Gastos.exe`. Ele não precisa de instalação, mas o Windows pode exibir um aviso do SmartScreen porque o executável não está assinado digitalmente.

O ícone `icon.ico` contém versões em vários tamanhos, geradas com suavização a partir de `icon-512.png` para manter a nitidez em diferentes tamanhos de exibição. O empacotamento arquiva os arquivos do app e ofusca os scripts JavaScript no executável. A versão original e legível continua em `index.html`.

## Supabase e proteção de dados

O app usa a integração Supabase configurada em `index.html`. A chave `anon`/publishable do Supabase é uma chave pública de cliente e não deve ser tratada como senha. Nunca coloque uma chave `service_role` ou `sb_secret_` no HTML ou no executável. Configure políticas RLS no Supabase para que cada usuário só possa ler e alterar os próprios registros.

O botão **Esqueci minha senha** envia um link pelo Supabase e retorna à página atual para cadastrar a nova senha. Em **Authentication → URL Configuration → Redirect URLs**, permita `http://127.0.0.1:47631/**` para o executável e também o endereço em que o HTML está publicado, incluindo o caminho quando o app estiver em uma subpasta (por exemplo, `https://usuario.github.io/meu-app/**`). Para login, sincronização e modo offline/PWA funcionarem, abra o app por um endereço HTTP/HTTPS; abrir `index.html` diretamente com `file://` não oferece esses recursos de forma confiável.

O aplicativo salva dados e sessão no armazenamento local do navegador/WebView. Use o botão **Backup** regularmente, especialmente antes de trocar de computador.
