<?php

declare(strict_types=1);

// Tokenizes a line slice of a PHP file into significant token texts, for the
// verbatim verifier (scripts/parity/verify.mjs).
//
// Usage: php tokenize-php.php <file> <startLine> <endLine>

if ($argc < 4) {
    fwrite(STDERR, "usage: php tokenize-php.php <file> <startLine> <endLine>\n");
    exit(2);
}

[, $file, $start, $end] = $argv;
$code = file_get_contents($file);
if ($code === false) {
    fwrite(STDERR, "cannot read: {$file}\n");
    exit(1);
}

$lines = preg_split('/\r?\n/', $code);
$slice = implode("\n", array_slice($lines, (int) $start - 1, (int) $end - (int) $start + 1));

$out = [];
foreach (token_get_all('<?php ' . $slice) as $token) {
    if (is_array($token)) {
        if (in_array($token[0], [T_WHITESPACE, T_COMMENT, T_DOC_COMMENT, T_OPEN_TAG], true)) {
            continue;
        }
        $out[] = $token[1];
        continue;
    }
    $out[] = $token;
}

echo json_encode($out, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
