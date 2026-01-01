fn main(input: [u8;32], expected: [u8;32]) {
    let actual = std::hash::blake3(input);
    assert_eq(actual, expected)
}

#[test]
fn test_main_returns_true_when_valid() {
    let input = [1;32];
    let expected = std::hash::blake3(input);
    main(input, expected);
}

#[test]
fn test_main_returns_false_when_invalid() {
    let bad_input = [2;32];
    let input = [1;32];
    let expected = std::hash::blake3(input);
    main(bad_input, expected);
}
