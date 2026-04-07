#!/usr/bin/env python3
"""
Demo script that writes output to a file
"""
import datetime

def main():
    output_file = "output.txt"
    
    with open(output_file, 'w') as f:
        f.write("=" * 50 + "\n")
        f.write("Demo Script Output\n")
        f.write("=" * 50 + "\n\n")
        
        f.write(f"Timestamp: {datetime.datetime.now()}\n\n")
        
        f.write("This script demonstrates:\n")
        f.write("- Writing to a file\n")
        f.write("- Formatting output\n")
        f.write("- Leaving the file for inspection\n\n")
        
        # Some calculations
        f.write("Sample calculations:\n")
        for i in range(1, 6):
            f.write(f"  {i} squared = {i**2}\n")
        
        f.write("\n")
        f.write("Script completed successfully!\n")
    
    print(f"Output written to {output_file}")

if __name__ == "__main__":
    main()
