#!/usr/bin/env python

# generates randomizer.js from the files in dat/ and src/

import glob

outfile = open('randomizer.js', 'w')

outfile.write('// generated code, DO NOT EDIT\n')

for path in sorted(glob.glob('dat/*')):
    with open(path) as infile:
        outfile.write('\n// included from ' + path + '\n')
        outfile.write('const ' + path[4:].replace('.json', '') + ' = ')
        outfile.write(infile.read()[:-1] + ';\n')

for path in sorted(glob.glob('src/*')):
    with open(path) as infile:
        outfile.write('\n// included from ' + path + '\n\n')
        outfile.write(infile.read())

outfile.close()
