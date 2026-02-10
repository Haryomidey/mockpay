$files = Get-ChildItem -Recurse -Filter *.ts -File src
foreach ($file in $files) {
  $content = Get-Content $file.FullName -Raw
  $updated = $content -replace 'from "(\.{1,2}/[^"]+?)(?<!\.js)"', 'from "$1.js"'
  $updated = $updated -replace "from '(\.{1,2}/[^']+?)(?<!\.js)'", "from '$1.js'"
  if ($updated -ne $content) {
    Set-Content -Path $file.FullName -Value $updated
  }
}
