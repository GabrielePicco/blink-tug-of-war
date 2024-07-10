import React from 'react';

type ButtonProps = {
    title: string;
    resetGame: () => void;
};

const Button: React.FC<ButtonProps> = ({ title, resetGame }) => {
    return <button onClick={() => resetGame()}>{title}</button>;
};

export default Button;
