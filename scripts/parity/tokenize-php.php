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

// token_get_all() splits an interpolated double-quoted string ("[{$x}] ...")
// into its delimiter '"' and interior pieces (literal text, '{', T_VARIABLE,
// '}') as separate tokens, unlike a JS template literal, which the tokenizer
// on the other side reads whole. Recompose the run between a '"' delimiter
// pair back into the one token canonicalString() already knows how to read,
// so both sides compare a single string instead of the PHP side scattering
// across several -- a plain (non-interpolated) string is never split this
// way and passes through untouched.
$out = [];
$inInterpolatedString = false;
$buffer = '';
foreach (token_get_all('<?php ' . $slice) as $token) {
    if ($inInterpolatedString) {
        if ($token === '"') {
            $out[] = $buffer . '"';
            $inInterpolatedString = false;
            $buffer = '';
        } else {
            $buffer .= is_array($token) ? $token[1] : $token;
        }
        continue;
    }
    if ($token === '"') {
        $inInterpolatedString = true;
        $buffer = '"';
        continue;
    }
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
