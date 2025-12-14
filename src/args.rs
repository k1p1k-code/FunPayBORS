use std::process::exit;

pub struct ArgsOption{
    pub golden_key: Option<String>,
    pub path_config: Option<String>,
}

impl ArgsOption {
    pub fn new() -> ArgsOption {
        let mut args = std::env::args().skip(1);
        let mut golden_key: Option<String> = None;
        let mut path_config: Option<String> = None;
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--golden_key" | "-gk" => {
                    if golden_key.is_none() {
                        if let Some(value) = args.next() {
                            golden_key = Some(value);
                        } else {
                            eprintln!("Error: no value specified for --golden_key");
                        }
                    } else {
                        eprintln!("Warning: --golden_key specified multiple times");
                    }
                }
                "--path_config" | "-pc" => {
                    if path_config.is_none() {
                        if let Some(value) = args.next() {
                            path_config = Some(value);
                        } else {
                            eprintln!("Error: no value specified for --path_config");
                        }
                    } else {
                        eprintln!("Warning: --path_config specified multiple times");
                    }
                }
                "--help" | "-h" => {
                    Self::print_help();
                    std::process::exit(0);
                }
                unknown => {
                    eprintln!("Unknown argument: {}", unknown);
                    Self::print_help();
                    std::process::exit(1);
                }
            }
        }

        ArgsOption { golden_key, path_config }
    }

    fn print_help() {
        println!("Usage:");
        println!("  program [OPTIONS]");
        println!();
        println!("Options:");
        println!("  -gk, --golden_key KEY   FunPay golden key");
        println!("  -pc, --path_config PATH Path to configuration file");
        println!("  -h,  --help             Show this help message");
        exit(31);
    }
}